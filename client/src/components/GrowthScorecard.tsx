import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
const date = (n:number) => new Date(Date.now()-n*86400000).toISOString().slice(0,10);
const stages = [["estimator_view","Estimator visits"],["estimator_complete","Completed estimates"],["comps_view","Comparable result views"],["comp_click","Comparable detail clicks"],["listing_view","Inventory detail views"],["dealer_contact_click","Dealer contact clicks"]];
type Report = {stages:{event_type:string;events:number;sessions:number}[];search:null|{impressions:number;clicks:number;imported_at:string};methodology:string};
export function GrowthScorecard({adminToken}:{adminToken:string}) {
  const [start,setStart]=useState(date(28)),[end,setEnd]=useState(date(1));
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  const [impressions,setImpressions]=useState(""),[clicks,setClicks]=useState(""),[saving,setSaving]=useState(false);
  useEffect(()=>{
    const a=new AbortController(); setData(null);setError("");
    fetch(`/api/admin/growth-scorecard?start=${start}&end=${end}`,{headers:{"x-admin-token":adminToken},signal:a.signal})
      .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Scorecard unavailable");return d;})
      .then(setData).catch(e=>{if(!a.signal.aborted)setError(e.message);});
    return ()=>a.abort();
  },[start,end,refresh,adminToken]);
  async function importSearch(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError("");
    try {
      const r=await fetch("/api/admin/growth-search-snapshot",{method:"POST",headers:{"Content-Type":"application/json","x-admin-token":adminToken},body:JSON.stringify({startDate:start,endDate:end,impressions:Number(impressions),clicks:Number(clicks)})});
      if(!r.ok)throw Error("Import failed. Check dates, permissions and counts (clicks cannot exceed impressions).");
      setRefresh(v=>v+1);
    }catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  return <section className="space-y-6" aria-label="Growth scorecard">
    <div><h2 className="text-2xl font-bold">Growth scorecard</h2><p className="text-muted-foreground mt-2">Measure discovery and buyer actions separately. Contact clicks indicate interest, not confirmed leads or revenue.</p></div>
    <div className="flex flex-wrap gap-4 items-end">
      <label className="text-sm">Start date<input aria-label="Scorecard start date" className="block border rounded p-2" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label className="text-sm">End date (inclusive)<input aria-label="Scorecard end date" className="block border rounded p-2" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <Button variant="outline" onClick={()=>setRefresh(v=>v+1)}>Refresh scorecard</Button>
    </div>
    {error && <p role="alert" className="border border-red-300 rounded p-4 text-red-800">{error}</p>}
    {!data&&!error&&<p role="status">Loading scorecard…</p>}
    {data&&<>
      <div className="grid sm:grid-cols-2 gap-4">
        {[["Google impressions",data.search?.impressions],["Google clicks",data.search?.clicks]].map(([label,value])=><div key={String(label)} className="border rounded-lg p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold mt-2">{value===undefined?"Not imported":Number(value).toLocaleString()}</p></div>)}
      </div>
      <p className="text-sm text-muted-foreground">{data.search ? `Search CTR: ${data.search.impressions ? (100*data.search.clicks/data.search.impressions).toFixed(2)+"%" : "n/a"}. Snapshot imported ${new Date(data.search.imported_at).toLocaleString()}.` : "No Search Console snapshot matches this exact date range. Import the property totals, not the sum of query rows."}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left p-3">On-site stage</th><th className="text-right p-3">Events</th><th className="text-right p-3">Page-load sessions</th></tr></thead><tbody>
        {stages.map(([key,label])=>{const row=data.stages.find(s=>s.event_type===key);return <tr key={key} className="border-b"><td className="p-3">{label}</td><td className="text-right p-3">{Number(row?.events||0).toLocaleString()}</td><td className="text-right p-3">{Number(row?.sessions||0).toLocaleString()}</td></tr>;})}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">{data.methodology} Tracking starts when deployed; zero recorded events does not establish complete instrumentation or zero visitors. Do Not Track and blocked requests are excluded.</p>
    </>}
    <details className="border rounded-lg p-4"><summary className="cursor-pointer font-medium">Import Search Console totals</summary>
      <p className="text-sm mt-3">Use sc-domain:golfcartiq.com, Web search, the exact dates above, no query/page filters. Saving replaces a snapshot for the same dates. This is a manual import, not a live Google connection.</p>
      <form onSubmit={importSearch} className="flex flex-wrap items-end gap-3 mt-4">
        <label className="text-sm">Impressions<input required type="number" min="0" step="1" value={impressions} onChange={e=>setImpressions(e.target.value)} className="block border rounded p-2 w-40"/></label>
        <label className="text-sm">Clicks<input required type="number" min="0" step="1" value={clicks} onChange={e=>setClicks(e.target.value)} className="block border rounded p-2 w-40"/></label>
        <Button disabled={saving} type="submit">{saving?"Saving…":"Save search snapshot"}</Button>
      </form>
    </details>
  </section>;
}
