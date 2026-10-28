import Foundation

/** A suspended deadline must never replay as a fresh foreground chime on resume. */
enum RestFeedbackPolicy {
  static func delivery(deadline: Double, now: Double, active: Bool) -> String {
    guard deadline.isFinite, now.isFinite, deadline > 0, now >= deadline, now - deadline < 2000 else { return "expired" }
    return active ? "foreground" : "background"
  }
}
