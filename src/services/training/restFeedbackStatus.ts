/** Local timer diagnostics, never persisted or sent to an analytics service. */
export interface RestFeedbackStatus {
  phase: string;
  scheduleCount?: number;
  deadline?: number;
  firedAt?: number;
  applicationState?: number;
  firedApplicationState?: number;
  audioPlayed?: boolean;
  outputVolume?: number;
  outputTypes?: string[];
  error?: number;
  activationError?: number;
  otherAudioPlaying?: boolean;
  soundResourceAvailable?: boolean;
  notificationAuthorization?: number;
  notificationSound?: number;
  notificationAlerts?: number;
  notificationLockScreen?: number;
  pendingRestCount?: number;
  pendingRestHasSound?: boolean;
  deliveredRestCount?: number;
  lastReturnedDeliveredRestCount?: number;
  lastReturnedDeliveredAt?: number;
}
