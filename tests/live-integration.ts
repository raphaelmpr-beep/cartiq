import dotenv from "dotenv";
import assert from "node:assert/strict";
import express from "express";
import {readFileSync} from "node:fs";
import { growthStorage } from "../server/growth-storage";
import { registerGrowthRoutes } from "../server/growth-routes";

dotenv.config({path:"/tmp/cartiq-integration.env"});
const originalFetch=globalThis.fetch;
let remoteReads=0;
globalThis.fetch=async (input,init)=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  const method=(init?.method || (input instanceof Request?input.method:"GET")).toUpperCase();
  if(url.hostname!=="127.0.0.1"){
    // Supabase's scorecard RPC is a stable SELECT-only function; allow its POST.
    const readRpc=url.pathname==="/rest/v1/rpc/growth_scorecard" && method==="POST";
    assert.ok(["GET","HEAD"].includes(method)||readRpc,`Blocked external write: ${method} ${url.pathname}`);
    assert.equal(url.origin,new URL(process.env.SUPABASE_URL!).origin);
    remoteReads++;
  }
  return originalFetch(input,init);
};
const app=express();app.use(express.json());
registerGrowthRoutes(app,(_req,res)=>{res.status(401).end();});
const server=app.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address() as {port:number};
const endpoint=`http://127.0.0.1:${address.port}`;
try {
  const snapshotPath=process.argv[2];
  let candidates:any[];
  if(snapshotPath){
    const blocked=await fetch(`${endpoint}/api/valuation/comparables`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({brand:"Club Car",model:"Tempo",year:2020,condition:"Good",power:"Electric",batteryType:"Lithium",seating:2,state:"FL"})});
    const blockedData=await blocked.json();
    assert.equal(blocked.status,503);
    assert.deepEqual(blockedData.items,[]);
    console.log(JSON.stringify({check:"missing_configuration_fails_closed",status:blocked.status,message:blockedData.message}));
    const envelope=JSON.parse(readFileSync(snapshotPath,"utf8"));
    const raw=envelope.result.result;
    const rows=JSON.parse(raw.slice(raw.indexOf("\n[")+1,raw.indexOf("\n</untrusted-data-")));
    candidates=rows[0].audit.candidates;
    growthStorage.candidates=async()=>candidates;
    console.log(JSON.stringify({mode:"live_database_snapshot_replay",security:rows[0].audit.security}));
  } else candidates=await growthStorage.candidates();
  console.log(JSON.stringify({check:"live_candidate_fetch",count:candidates.length,rows:candidates.map(r=>({
    id:r.listing_id,checkedAt:r.checked_at,sourcePrice:r.source_price,
    flags:{vehicle:r.valid_vehicle,branch:r.branch_verified,stock:r.in_stock},
    listing:r.listing&&{id:r.listing.id,brand:r.listing.brand,model:r.listing.model,year:r.listing.year,seating:r.listing.seating,power:r.listing.power_type,battery:r.listing.battery_type,price:r.listing.asking_price,status:r.listing.status,dealerId:r.listing.dealer_id}
  }))}));
  const input={brand:"Club Car",model:"Tempo",year:2020,condition:"Good",power:"Electric",batteryType:"Lithium",seating:2,state:"FL"};
  const checks=[
    {name:"verified_ponte_vedra",input,expected:[1457]},
    {name:"gas_unknown_seating_excluded",input:{...input,year:2022,power:"Gas",batteryType:undefined},expected:[]},
    {name:"wrong_seating_excluded",input:{...input,seating:4},expected:[]},
    {name:"wrong_battery_excluded",input:{...input,batteryType:"Lead-Acid"},expected:[]},
    {name:"wrong_state_excluded",input:{...input,state:"GA"},expected:[]},
    {name:"poor_condition_excluded",input:{...input,condition:"Poor"},expected:[]},
  ];
  for(const c of checks){
    const res=await fetch(`${endpoint}/api/valuation/comparables`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c.input)});
    const data=await res.json();
    assert.equal(res.status,200,JSON.stringify({check:c.name,data}));
    assert.deepEqual(data.items.map((i:any)=>i.id),c.expected,c.name);
    if(c.expected.length)assert.equal(data.items[0].askingPrice,9799);
    console.log(JSON.stringify({check:c.name,status:res.status,items:data.items.map((i:any)=>({id:i.id,askingPrice:i.askingPrice,sourceUrl:i.sourceUrl}))}));
  }
  if(!snapshotPath){
    const report=await growthStorage.report("2026-09-16T00:00:00Z","2026-09-17T00:00:00Z");
    console.log(JSON.stringify({check:"live_scorecard_read",stages:report.stages,searchSnapshotPresent:report.search!==null}));
  }
  const admin=await fetch(`${endpoint}/api/admin/growth-scorecard?start=2026-09-16&end=2026-09-16`);
  assert.equal(admin.status,401);
  console.log(JSON.stringify({check:"unauthenticated_admin_denied",status:admin.status}));
  console.log(JSON.stringify({result:snapshotPath?"SNAPSHOT_REPLAY_PASS_LIVE_CONNECTION_BLOCKED":"PASS",remoteReads,productionWrites:0}));
} finally {
  globalThis.fetch=originalFetch;
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
