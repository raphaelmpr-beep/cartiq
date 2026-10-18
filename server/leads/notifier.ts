// Lead volume alert delivery (DRAFT): logs only. SRE's daily log check looks for the
// structured line `LEAD_VOLUME_ALERT {json}`. No webhook/email (out of scope).
export interface VolumeAlertPayload {
  type: "LEAD_VOLUME_ALERT"; at: string; reason: string;
  latest: { day: string; events: number } | null; baseline: number | null; pausedSet: boolean;
}
export type Notifier = (a: VolumeAlertPayload) => void;
export const logNotifier = (log: (line: string) => void = (l) => console.error(l)): Notifier =>
  (a) => log(`LEAD_VOLUME_ALERT ${JSON.stringify(a)}`);
