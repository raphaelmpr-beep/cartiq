import type { GrowthEvent } from "@shared/growth";
let sessionId: string | undefined;
const seen = new Set<string>();
export function trackGrowth(eventType: GrowthEvent["eventType"], details: {listingId?:number;channel?:"phone"|"email"|"website"} = {}, once?: string) {
  if (navigator.doNotTrack === "1" || !globalThis.crypto?.randomUUID) return;
  if (once && seen.has(once)) return;
  if (once) seen.add(once);
  sessionId ||= crypto.randomUUID();
  void fetch("/api/track/growth", {
    method:"POST", headers:{"Content-Type":"application/json"}, keepalive:true,
    body:JSON.stringify({eventId:crypto.randomUUID(),sessionId,eventType,...details}),
  }).catch(() => {});
}
