import ExpoModulesCore
import HealthKit
import CryptoKit
import AVFAudio
import AudioToolbox
import UIKit
import UserNotifications

struct VigorHealthWorkout: Record {
  @Field var identity: String = ""
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
}

public class VigorHealthModule: Module {
  private let store = HKHealthStore()
  private var restWork: DispatchWorkItem?
  private var restPlayer: AVAudioPlayer?
  private var restAudioRelease: DispatchWorkItem?
  // Device-local acceptance diagnostics only: no identities or Health samples.
  private var restStatus: [String: Any] = ["phase": "idle", "scheduleCount": 0]
  private var restScheduleCount = 0

  private var bioTypes: Set<HKObjectType> {
    [HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
     HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
     HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!]
  }

  private var nightRMSSD: HKQuantityType? {
    if #available(iOS 27.0, *) {
      return HKObjectType.quantityType(forIdentifier: .heartRateVariabilityRMSSD)
    }
    return nil
  }

  private var bioNightTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = [HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
      HKObjectType.quantityType(forIdentifier: .heartRate)!,
      HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!]
    if let rmssd = nightRMSSD { types.insert(rmssd) }
    return types
  }

  private func bioSamples(_ type: HKSampleType, metric: String, start: Date, end: Date, night: Bool = false) async -> [String: Any] {
    do {
      let cap = night ? 50000 : 20000
      let samples: [HKSample] = try await withCheckedThrowingContinuation { continuation in
        let query = HKSampleQuery(sampleType: type,
          predicate: HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate, .strictEndDate]),
          limit: cap + 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
          if let error { continuation.resume(throwing: error) }
          else { continuation.resume(returning: samples ?? []) }
        }
        self.store.execute(query)
      }
      guard samples.count <= cap else { return ["samples": [], "error": false, "truncated": true] }
      let observations: [[String: Any]] = samples.compactMap { sample in
        let value: Double
        var sleepState: String?
        if let sleep = sample as? HKCategorySample {
          guard let category = HKCategoryValueSleepAnalysis(rawValue: sleep.value) else { return nil }
          if HKCategoryValueSleepAnalysis.allAsleepValues.contains(category) { sleepState = "ASLEEP" }
          else if night && category == .awake { sleepState = "AWAKE" }
          else if night && category == .inBed { sleepState = "IN_BED" }
          else { return nil }
          value = sleep.endDate.timeIntervalSince(sleep.startDate) / 60
        } else if let quantity = sample as? HKQuantitySample {
          value = quantity.quantity.doubleValue(for: (metric == "RESTING_HR" || metric == "HEART_RATE") ? HKUnit.count().unitDivided(by: .minute()) : .secondUnit(with: .milli))
        } else { return nil }
        let source = sample.sourceRevision
        var observation: [String: Any] = ["id": sample.uuid.uuidString, "metric": metric, "value": value,
          "start": sample.startDate.timeIntervalSince1970 * 1000, "end": sample.endDate.timeIntervalSince1970 * 1000,
          "sourceId": source.source.bundleIdentifier + ":" + (source.productType ?? "unspecified") + ":" + (source.version ?? "unspecified")
            + ":" + SHA256.hash(data: Data((sample.device?.localIdentifier ?? sample.device?.name ?? "unspecified").utf8)).map { String(format: "%02x", $0) }.joined(),
          "sourceName": source.source.name,
          "manuallyEntered": sample.metadata?[HKMetadataKeyWasUserEntered] as? Bool ?? false]
        if night, let sleepState { observation["sleepState"] = sleepState }
        return observation
      }
      return ["samples": observations, "error": false, "truncated": false]
    } catch { return ["samples": [], "error": true, "truncated": false] }
  }

  private func authorization() -> String {
    guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
    switch store.authorizationStatus(for: HKObjectType.workoutType()) {
    case .sharingAuthorized: return "authorized"
    case .sharingDenied: return "denied"
    default: return "notDetermined"
    }
  }

  private func cardioKind(_ activity: HKWorkoutActivityType) -> String? {
    switch activity {
    case .running: return "RUNNING"
    case .cycling: return "CYCLING"
    case .walking: return "WALKING"
    case .hiking: return "HIKING"
    case .rowing: return "ROWING"
    case .elliptical: return "ELLIPTICAL"
    case .stairClimbing, .stairs, .stepTraining: return "STAIRS"
    case .swimming: return "SWIMMING"
    case .tennis: return "TENNIS"
    case .soccer: return "FOOTBALL"
    case .basketball: return "BASKETBALL"
    case .highIntensityIntervalTraining: return "HIIT"
    case .mixedCardio, .crossTraining, .swimBikeRun: return "MIXED"
    default: return nil
    }
  }

  private func readCardioHistory(startMs: Double, endMs: Double) async throws -> [String: Any] {
    guard HKHealthStore.isHealthDataAvailable(), startMs.isFinite, endMs.isFinite,
      startMs > 0, endMs > startMs, endMs - startMs <= 45 * 86400000,
      endMs <= Date().timeIntervalSince1970 * 1000 else {
      throw NSError(domain: "VigorHealth", code: 6, userInfo: [NSLocalizedDescriptionKey: "Invalid cardio history window"])
    }
    var earliestAllowed: Date?
    if #available(iOS 27.0, *) {
      let dates = try await self.store.earliestAuthorizedSampleDate(for: [HKObjectType.workoutType()])
      earliestAllowed = dates[HKObjectType.workoutType()]
    }
    let requestedStart = Date(timeIntervalSince1970: startMs / 1000)
    let queryStart = max(requestedStart, earliestAllowed ?? requestedStart)
    let supported: [HKWorkoutActivityType] = [.running, .cycling, .walking, .hiking, .rowing, .elliptical,
      .stairClimbing, .stairs, .stepTraining, .swimming, .tennis, .soccer, .basketball,
      .highIntensityIntervalTraining, .mixedCardio, .crossTraining, .swimBikeRun]
    let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
      HKQuery.predicateForSamples(withStart: queryStart,
        end: Date(timeIntervalSince1970: endMs / 1000), options: [.strictStartDate, .strictEndDate]),
      NSCompoundPredicate(orPredicateWithSubpredicates: supported.map { HKQuery.predicateForWorkouts(with: $0) })
    ])
    let samples: [HKSample] = try await withCheckedThrowingContinuation { continuation in
      let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 1001,
        sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
        if let error { continuation.resume(throwing: error) }
        else { continuation.resume(returning: samples ?? []) }
      }
      self.store.execute(query)
    }
    // Never treat the newest capped subset as a complete exposure history.
    var result: [String: Any] = ["version": 1, "truncated": samples.count > 1000, "workouts": []]
    if let earliestAllowed { result["earliestAllowedStart"] = earliestAllowed.timeIntervalSince1970 * 1000 }
    if samples.count > 1000 { return result }
    let observations: [[String: Any]] = samples.compactMap { sample in
      guard let workout = sample as? HKWorkout, let kind = self.cardioKind(workout.workoutActivityType) else { return nil }
      let source = workout.sourceRevision.source
      let mixed = kind == "MIXED" || workout.workoutActivities.contains { self.cardioKind($0.workoutConfiguration.activityType) != kind }
      var observation: [String: Any] = ["id": workout.uuid.uuidString, "kind": kind,
        "start": workout.startDate.timeIntervalSince1970 * 1000, "end": workout.endDate.timeIntervalSince1970 * 1000,
        "durationSeconds": workout.duration, "sourceId": source.bundleIdentifier, "sourceName": source.name,
        "manuallyEntered": workout.metadata?[HKMetadataKeyWasUserEntered] as? Bool ?? false,
        "ownExport": source.bundleIdentifier == Bundle.main.bundleIdentifier,
        "mixedActivities": mixed]
      // Workout summaries only: no route, pulse, energy or extra quantity queries/permissions.
      if let distance = workout.totalDistance { observation["distanceMetres"] = distance.doubleValue(for: .meter()) }
      if let external = workout.metadata?[HKMetadataKeyExternalUUID] as? String, !external.isEmpty, external.utf8.count <= 4096 {
        observation["externalId"] = SHA256.hash(data: Data(external.utf8)).map { String(format: "%02x", $0) }.joined()
      }
      return observation
    }
    result["workouts"] = observations
    return result
  }

  private func syncIdentifier(_ input: VigorHealthWorkout) throws -> String {
    guard !input.identity.isEmpty, input.identity.utf8.count <= 4096,
      input.startMs.isFinite, input.endMs.isFinite,
      input.startMs > 0, input.endMs > input.startMs,
      input.endMs <= Date().timeIntervalSince1970 * 1000 else {
      throw NSError(domain: "VigorHealth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid completed workout"])
    }
    // Do not expose the account or Vigor document identity in Health metadata.
    let digest = SHA256.hash(data: Data(input.identity.utf8)).map { String(format: "%02x", $0) }.joined()
    return "vigor.workout.\(digest)"
  }

  public func definition() -> ModuleDefinition {
    Name("VigorHealth")
    AsyncFunction("cardioHistoryAvailable") { HKHealthStore.isHealthDataAvailable() }
    AsyncFunction("authorizeCardioHistory") { () async throws in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw NSError(domain: "VigorHealth", code: 4, userInfo: [NSLocalizedDescriptionKey: "Health data unavailable"])
      }
      try await self.store.requestAuthorization(toShare: [], read: [HKObjectType.workoutType()])
    }
    AsyncFunction("readCardioHistory") { (startMs: Double, endMs: Double) async throws -> [String: Any] in
      try await self.readCardioHistory(startMs: startMs, endMs: endMs)
    }
    AsyncFunction("bioAvailable") { HKHealthStore.isHealthDataAvailable() }
    AsyncFunction("bioNightAvailable") { HKHealthStore.isHealthDataAvailable() }
    AsyncFunction("authorizeBioNight") { () async throws in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw NSError(domain: "VigorHealth", code: 4, userInfo: [NSLocalizedDescriptionKey: "Health data unavailable"])
      }
      try await self.store.requestAuthorization(toShare: [], read: self.bioNightTypes)
    }
    AsyncFunction("readBioNight") { (startMs: Double, endMs: Double) async throws -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable(), startMs.isFinite, endMs.isFinite,
        startMs > 0, endMs > startMs, endMs - startMs <= 72 * 86400000,
        endMs <= Date().timeIntervalSince1970 * 1000 else {
        throw NSError(domain: "VigorHealth", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid overnight window"])
      }
      let start = Date(timeIntervalSince1970: startMs / 1000), end = Date(timeIntervalSince1970: endMs / 1000)
      async let sleep = self.bioSamples(HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!, metric: "SLEEP", start: start, end: end, night: true)
      async let pulse = self.bioSamples(HKObjectType.quantityType(forIdentifier: .heartRate)!, metric: "HEART_RATE", start: start, end: end, night: true)
      async let sdnn = self.bioSamples(HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!, metric: "HRV_SDNN", start: start, end: end, night: true)
      let rmssd: [String: Any]
      if let type = self.nightRMSSD { rmssd = await self.bioSamples(type, metric: "HRV_RMSSD", start: start, end: end, night: true) }
      else { rmssd = ["samples": [], "error": false, "truncated": false, "unsupported": true] }
      return await ["version": 1, "metrics": ["SLEEP": sleep, "HEART_RATE": pulse, "HRV_SDNN": sdnn, "HRV_RMSSD": rmssd]]
    }
    AsyncFunction("authorizeBio") { () async throws in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw NSError(domain: "VigorHealth", code: 4, userInfo: [NSLocalizedDescriptionKey: "Health data unavailable"])
      }
      // Read completion never reveals which permissions the person granted.
      try await self.store.requestAuthorization(toShare: [], read: self.bioTypes)
    }
    AsyncFunction("readBio") { (startMs: Double, endMs: Double) async throws -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable(), startMs.isFinite, endMs.isFinite,
        startMs > 0, endMs > startMs, endMs - startMs <= 45 * 86400000,
        endMs <= Date().timeIntervalSince1970 * 1000 else {
        throw NSError(domain: "VigorHealth", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid Bio window"])
      }
      let start = Date(timeIntervalSince1970: startMs / 1000), end = Date(timeIntervalSince1970: endMs / 1000)
      async let sleep = self.bioSamples(HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!, metric: "SLEEP", start: start, end: end)
      async let rhr = self.bioSamples(HKObjectType.quantityType(forIdentifier: .restingHeartRate)!, metric: "RESTING_HR", start: start, end: end)
      async let hrv = self.bioSamples(HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!, metric: "HRV_SDNN", start: start, end: end)
      return await ["SLEEP": sleep, "RESTING_HR": rhr, "HRV_SDNN": hrv]
    }
    AsyncFunction("restFeedbackStatus") { () async -> [String: Any] in
      var status = await MainActor.run {
        var current = self.restStatus
        current["applicationState"] = UIApplication.shared.applicationState.rawValue
        current["outputVolume"] = AVAudioSession.sharedInstance().outputVolume
        current["outputTypes"] = AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType.rawValue }
        current["otherAudioPlaying"] = AVAudioSession.sharedInstance().isOtherAudioPlaying
        current["soundResourceAvailable"] = Bundle.main.url(forResource: "rest-chime", withExtension: "wav") != nil
        return current
      }
      // Read-only diagnostics: distinguish foreground player acceptance from
      // locked-screen OS delivery. Never request permission or inspect other alerts.
      let center = UNUserNotificationCenter.current()
      let settings = await center.notificationSettings()
      let pending = await center.pendingNotificationRequests().filter { $0.identifier == "vigor-rest" || $0.content.userInfo["kind"] as? String == "rest" }
      let delivered = await center.deliveredNotifications().filter { $0.request.identifier == "vigor-rest" || $0.request.content.userInfo["kind"] as? String == "rest" }
      status["notificationAuthorization"] = settings.authorizationStatus.rawValue
      status["notificationSound"] = settings.soundSetting.rawValue
      status["notificationAlerts"] = settings.alertSetting.rawValue
      status["notificationLockScreen"] = settings.lockScreenSetting.rawValue
      status["pendingRestCount"] = pending.count
      status["pendingRestHasSound"] = pending.contains { $0.content.sound != nil }
      status["deliveredRestCount"] = delivered.count
      return status
    }
    AsyncFunction("recordRestDeliverySnapshot") { (count: Int) async in
      // Keep just a local count and timestamp; no notification content or user data.
      await MainActor.run {
        self.restStatus["lastReturnedDeliveredRestCount"] = max(0, count)
        self.restStatus["lastReturnedDeliveredAt"] = Date().timeIntervalSince1970 * 1000
      }
    }
    AsyncFunction("scheduleRestFeedback") { (deadline: Double?) throws -> Bool in
      self.restScheduleCount += 1
      self.restWork?.cancel()
      self.restWork = nil
      let wasPlaying = self.restAudioRelease != nil
      self.restAudioRelease?.cancel()
      self.restAudioRelease = nil
      self.restPlayer?.stop()
      if wasPlaying {
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
      }
      self.restStatus = ["phase": "idle", "scheduleCount": self.restScheduleCount]
      guard let deadline, deadline.isFinite, deadline > Date().timeIntervalSince1970 * 1000 else { return true }
      self.restStatus["deadline"] = deadline
      guard let sound = Bundle.main.url(forResource: "rest-chime", withExtension: "wav") else {
        self.restStatus["phase"] = "missingSound"; return false
      }
      do {
        self.restPlayer = try AVAudioPlayer(contentsOf: sound)
      } catch {
        self.restStatus["phase"] = "preparationFailed"
        self.restStatus["error"] = (error as NSError).code
        throw error
      }
      self.restPlayer?.volume = 1
      self.restStatus["phase"] = "scheduled"
      let work = DispatchWorkItem { [weak self] in
        guard let self else { return }
        self.restStatus["firedAt"] = Date().timeIntervalSince1970 * 1000
        self.restStatus["firedApplicationState"] = UIApplication.shared.applicationState.rawValue
        let delivery = RestFeedbackPolicy.delivery(deadline: deadline, now: Date().timeIntervalSince1970 * 1000,
          active: UIApplication.shared.applicationState == .active)
        guard delivery == "foreground" else { self.restStatus["phase"] = delivery; return }
        // The scheduled notification owns background/locked delivery. Never replay it on resume.
        // Other players can change the shared session during the rest. Reassert
        // the category at delivery, and duck music only while the chime plays.
        self.restAudioRelease?.cancel()
        do {
          let audio = AVAudioSession.sharedInstance()
          try audio.setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
          try audio.setActive(true)
        } catch {
          self.restStatus["activationError"] = (error as NSError).code
        }
        self.restPlayer?.currentTime = 0
        self.restPlayer?.prepareToPlay()
        let played = self.restPlayer?.play() == true
        self.restStatus["audioPlayed"] = played
        self.restStatus["phase"] = "fired"
        if !played { AudioServicesPlayAlertSound(1005) }
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        let release = DispatchWorkItem { [weak self] in
          self?.restPlayer?.stop()
          self?.restAudioRelease = nil
          try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
          try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        }
        self.restAudioRelease = release
        DispatchQueue.main.asyncAfter(deadline: .now() + (self.restPlayer?.duration ?? 1) + 0.2, execute: release)
      }
      self.restWork = work
      DispatchQueue.main.asyncAfter(deadline: .now() + (deadline / 1000 - Date().timeIntervalSince1970), execute: work)
      return true
    }.runOnQueue(.main)
    AsyncFunction("authorization") { self.authorization() }
    AsyncFunction("authorize") { () async throws -> String in
      guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
      // No read, energy, heart-rate, background delivery or clinical permissions.
      try await self.store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
      return self.authorization()
    }
    AsyncFunction("saveWorkout") { (input: VigorHealthWorkout) async throws in
      let identifier = try self.syncIdentifier(input)
      guard self.authorization() == "authorized" else {
        throw NSError(domain: "VigorHealth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Workout write permission required"])
      }
      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .traditionalStrengthTraining
      configuration.locationType = .unknown
      let builder = HKWorkoutBuilder(healthStore: self.store, configuration: configuration, device: nil)
      do {
        try await builder.beginCollection(at: Date(timeIntervalSince1970: input.startMs / 1000))
        try await builder.addMetadata([HKMetadataKeySyncIdentifier: identifier, HKMetadataKeySyncVersion: 1])
        try await builder.endCollection(at: Date(timeIntervalSince1970: input.endMs / 1000))
        // No data source or quantity samples: never fabricate calories or HR.
        _ = try await builder.finishWorkout()
      } catch {
        builder.discardWorkout()
        throw error
      }
    }
    AsyncFunction("deleteWorkout") { (input: VigorHealthWorkout, promise: Promise) in
      do {
        let identifier = try self.syncIdentifier(input)
        guard self.authorization() == "authorized" else {
          throw NSError(domain: "VigorHealth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Workout write permission required"])
        }
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
          HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [identifier]),
          HKQuery.predicateForObjects(from: HKSource.default())
        ])
        // Apple additionally restricts deletion to objects saved by this app.
        self.store.deleteObjects(of: HKObjectType.workoutType(), predicate: predicate) { success, _, error in
          if let error { promise.reject(error) }
          else if success { promise.resolve() }
          else { promise.reject(NSError(domain: "VigorHealth", code: 3)) }
        }
      } catch { promise.reject(error) }
    }
  }
}
