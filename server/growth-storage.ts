import { createClient } from "@supabase/supabase-js";
import type { GrowthEvent } from "../shared/growth";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Growth storage not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const growthStorage = {
  async candidates() {
    const rows:any[]=[];
    const client=db(),cutoff=new Date(Date.now()-7*86400000).toISOString();
    for(let offset=0;offset<20000;offset+=1000){
      const {data,error}=await client.from("comp_verifications")
        .select("*,listing:listings!listing_id(*,dealer:dealers!dealer_id(id,name,slug))")
        .gte("checked_at",cutoff).order("listing_id").range(offset,offset+999);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<1000)return rows;
    }
    throw Error("Candidate scan cap reached; refusing partial coverage");
  },
  async event(e: GrowthEvent) {
    const { error } = await db().from("growth_events").upsert({
      event_id: e.eventId, session_id: e.sessionId, event_type: e.eventType,
      listing_id: e.listingId ?? null, channel: e.channel ?? null,
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (error) throw error;
  },
  async report(start: string, end: string) {
    const { data, error } = await db().rpc("growth_scorecard", { start_at: start, end_at: end });
    if (error) throw error;
    const search = await db().from("search_performance_snapshots").select("*")
      .eq("start_date", start.slice(0,10)).eq("end_date", new Date(Date.parse(end)-86400000).toISOString().slice(0,10)).maybeSingle();
    if (search.error) throw search.error;
    return { stages: data || [], search: search.data, start, end,
      methodology: "UTC dates for on-site events. Search Console dates are Pacific Time. Stage counts are independent, not an attributed conversion funnel. Contact clicks are not confirmed leads. Sessions reset on reload." };
  },
  async searchSnapshot(s: {startDate:string; endDate:string; impressions:number; clicks:number}) {
    const {error} = await db().from("search_performance_snapshots").upsert({
      start_date:s.startDate,end_date:s.endDate,impressions:s.impressions,clicks:s.clicks,
      imported_at:new Date().toISOString(),
    },{onConflict:"start_date,end_date"});
    if(error) throw error;
  },
};
