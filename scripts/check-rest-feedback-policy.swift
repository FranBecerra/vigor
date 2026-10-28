import Foundation

@main struct RestFeedbackPolicyChecks {
  static func main() {
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 10000, active: true) == "foreground")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 11999, active: true) == "foreground")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 12000, active: true) == "expired")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 10000, active: false) == "background")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 70000, active: false) == "expired")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 70000, active: true) == "expired")
    precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: 9999, active: true) == "expired")
    for invalid in [Double.nan, Double.infinity, -Double.infinity, 0, -1] {
      precondition(RestFeedbackPolicy.delivery(deadline: invalid, now: 10000, active: true) == "expired")
    }
    for invalid in [Double.nan, Double.infinity, -Double.infinity] {
      precondition(RestFeedbackPolicy.delivery(deadline: 10000, now: invalid, active: true) == "expired")
    }
    print("PASS: native rest delivery policy (15 cases); not a physical sound/haptic acceptance test")
  }
}
