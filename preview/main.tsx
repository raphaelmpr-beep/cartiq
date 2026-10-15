import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {GolfCartValueEstimatorPage} from "../client/src/pages/seo/ValuePages";
import {GrowthScorecard} from "../client/src/components/GrowthScorecard";
import {WarrantyPreview} from "./WarrantyPreview";
import "../client/src/index.css";
let mode="ready";
const nativeFetch=window.fetch.bind(window);
window.fetch=async (url,options)=>{
  const path=String(url);
  if(!path.startsWith("/api/"))return nativeFetch(url,options);
  if(path.includes("track/growth"))return new Response(null,{status:204});
  if(mode==="error")return Response.json({message:"Preview: storage unavailable. Missing data is not zero."},{status:503});
  if(path.includes("comparables")){
    const i=JSON.parse(String(options?.body||"{}"));
    return Response.json({status:"ready",message:mode==="empty"?"No recently source-verified close matches.":"Sample inventory only. Production requires real source verification.",items:mode==="empty"||i.condition==="Poor"?[]:[{id:999,slug:"preview-cart",title:`Sample ${i.year} ${i.brand} ${i.model}`,askingPrice:5995,imageUrl:"./sample-cart.svg",dealer:"Demo dealer (not a real offer)",city:"Jacksonville",state:"FL",year:i.year,condition:"used",checkedAt:new Date().toISOString(),sourceUrl:"https://example.com/inventory/sample",reasons:["Same brand and model",`${i.seating} seats · ${i.power}`,"Same model year","Cosmetic condition not matched"]}]});
  }
  if(path.includes("growth-search-snapshot"))return Response.json({ok:true});
  return Response.json({search:mode==="empty"?null:{impressions:4200,clicks:35,imported_at:new Date().toISOString()},stages:mode==="empty"?[]:[{event_type:"estimator_view",events:24,sessions:20},{event_type:"estimator_complete",events:18,sessions:16},{event_type:"comps_view",events:12,sessions:11},{event_type:"comp_click",events:8,sessions:7},{event_type:"listing_view",events:22,sessions:18},{event_type:"dealer_contact_click",events:4,sessions:3}],methodology:"SIMULATED COUNTS. UTC on-site dates; Pacific Search Console dates. Independent stages, not attributed conversions. Sessions reset on reload."});
};
function App(){
  const [tab,setTab]=useState(new URLSearchParams(location.search).get("tab")==="warranty"?"warranty":"estimator"),[version,setVersion]=useState(0);
  return <><header style={{background:"#142b22",color:"white"}} className="p-4">
    <div className="max-w-4xl mx-auto space-y-3">
      <p className="font-bold">GolfCartIQ · Private feature preview</p>
      <p className="text-sm">Sample inventory, simulated analytics and warranty display checks. No production writes.</p>
      <nav className="flex flex-wrap gap-4">
        <button className="underline" onClick={()=>setTab("estimator")}>Estimator + comps</button>
        <button className="underline" onClick={()=>setTab("growth")}>Growth scorecard</button>
        <button className="underline" onClick={()=>setTab("warranty")}>Warranty display</button>
        <label>Preview state <select style={{color:"#142b22",background:"white"}} className="rounded p-1" aria-label="Preview state" onChange={e=>{mode=e.target.value;setVersion(v=>v+1);}}><option value="ready">Populated</option><option value="empty">Empty</option><option value="error">Unavailable</option></select></label>
      </nav>
    </div>
  </header><main key={version}>{tab==="warranty"?<WarrantyPreview/>:tab==="estimator"?<GolfCartValueEstimatorPage/>:<div className="max-w-4xl mx-auto p-6"><GrowthScorecard adminToken="preview-only"/></div>}</main><footer className="text-center p-6 text-xs text-muted-foreground">Built with Perplexity Computer · Preview only</footer></>;
}
createRoot(document.getElementById("root")!).render(<App/>);
