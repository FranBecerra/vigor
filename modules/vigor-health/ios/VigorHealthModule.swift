import ExpoModulesCore
import HealthKit
import CryptoKit
import AVFAudio
import AudioToolbox
import UIKit

struct VigorHealthWorkout: Record {
  @Field var identity: String = ""
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
}

public class VigorHealthModule: Module {
  private let store = HKHealthStore()
  private var restWork: DispatchWorkItem?
  private var restPlayer: AVAudioPlayer?
  // Device-local acceptance diagnostics only: no identities or Health samples.
  private var restStatus: [String: Any] = ["phase": "idle", "scheduleCount": 0]
  private var restScheduleCount = 0

  private func authorization() -> String {
    guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
    switch store.authorizationStatus(for: HKObjectType.workoutType()) {
    case .sharingAuthorized: return "authorized"
    case .sharingDenied: return "denied"
    default: return "notDetermined"
    }
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
    AsyncFunction("restFeedbackStatus") { () -> [String: Any] in
      var status = self.restStatus
      status["applicationState"] = UIApplication.shared.applicationState.rawValue
      status["outputVolume"] = AVAudioSession.sharedInstance().outputVolume
      status["outputTypes"] = AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType.rawValue }
      return status
    }.runOnQueue(.main)
    AsyncFunction("scheduleRestFeedback") { (deadline: Double?) throws -> Bool in
      self.restScheduleCount += 1
      self.restWork?.cancel()
      self.restWork = nil
      self.restStatus = ["phase": "idle", "scheduleCount": self.restScheduleCount]
      guard let deadline, deadline.isFinite, deadline > Date().timeIntervalSince1970 * 1000 else { return true }
      self.restStatus["deadline"] = deadline
      guard let sound = Bundle.main.url(forResource: "rest-chime", withExtension: "wav") else {
        self.restStatus["phase"] = "missingSound"; return false
      }
      let audio = AVAudioSession.sharedInstance()
      do {
        try audio.setCategory(.playback, options: [.mixWithOthers])
        try audio.setActive(true)
        if self.restPlayer == nil { self.restPlayer = try AVAudioPlayer(contentsOf: sound) }
      } catch {
        self.restStatus["phase"] = "preparationFailed"
        self.restStatus["error"] = (error as NSError).code
        throw error
      }
      self.restPlayer?.volume = 1
      self.restPlayer?.prepareToPlay()
      self.restStatus["phase"] = "scheduled"
      let work = DispatchWorkItem { [weak self] in
        guard let self else { return }
        self.restStatus["firedAt"] = Date().timeIntervalSince1970 * 1000
        self.restStatus["firedApplicationState"] = UIApplication.shared.applicationState.rawValue
        guard UIApplication.shared.applicationState == .active else { self.restStatus["phase"] = "background"; return }
        // The scheduled notification owns background/locked delivery. Never replay it on resume.
        try? AVAudioSession.sharedInstance().setActive(true)
        self.restPlayer?.currentTime = 0
        let played = self.restPlayer?.play() == true
        self.restStatus["audioPlayed"] = played
        self.restStatus["phase"] = "fired"
        if !played { AudioServicesPlayAlertSound(1005) }
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
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
