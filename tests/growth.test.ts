import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { selectComparables } from "../server/comparables";
import { registerGrowthRoutes } from "../server/growth-routes";
import { growthStorage } from "../server/growth-storage";
import { eventSchema, searchSnapshotSchema, type CompInput } from "../shared/growth";
const now=Date.parse("2026-09-16T12:00:00Z");
const input:CompInput={brand:"Club Car",model:"Onward",year:2023,condition:"Good",power:"Electric",batteryType:"Lithium",seating:4,state:"FL"};
const row=()=>({dealer_id:1,valid_vehicle:true,branch_verified:true,in_stock:true,checked_at:new Date(now-1000).toISOString(),source_url:"https://dealer.example/inventory/cart",source_price:5995,listing:{id:1,dealer_id:1,dealer:{id:1,slug:"dealer",name:"Dealer"},sync_source:"dealer",status:"active",public_listing:true,source_url:"https://dealer.example/inventory/cart",asking_price:5995,image_url:"https://dealer.example/cart.jpg",slug:"cart",brand:"Club Car",model:"Onward",year:2023,power_type:"Electric",seating:4,state:"FL",city:"Jacksonville",condition:"used",battery_type:"Lithium"}});
test("verified exact match and numeric price",()=>assert.equal(selectComparables(input,[row()],now)[0].askingPrice,5995));
const invalid:{[key:string]:any}={asking_price:6995,brand:"Yamaha",model:"Tempo",year:2019,power_type:"Gas",seating:2,battery_type:"Lead-Acid",dealer_id:null,sync_source:"wrong-branch",status:"sold",public_listing:false,image_url:null,condition:"new",state:"AL",source_url:"https://dealer.example/blog/battery-care",slug:null};
for(const [key,value] of Object.entries(invalid)) test(`reject listing ${key}`,()=>{const r=row();(r.listing as any)[key]=value;assert.equal(selectComparables(input,[r],now).length,0);});
for(const [key,value] of Object.entries({valid_vehicle:false,branch_verified:false,in_stock:false,checked_at:new Date(now-8*86400000).toISOString(),source_price:100,source_url:"javascript:alert(1)"}))
  test(`reject verification ${key}`,()=>{const r=row();(r as any)[key]=value;assert.equal(selectComparables(input,[r],now).length,0);});
test("reject future verification",()=>{const r=row();r.checked_at=new Date(now+1000).toISOString();assert.equal(selectComparables(input,[r],now).length,0);});
test("deduplicate source",()=>assert.equal(selectComparables(input,[row(),row()],now).length,1));
test("poor condition fails closed",()=>assert.equal(selectComparables({...input,condition:"Poor"},[row()],now).length,0));
test("snapshot date and count validation",()=>{
  assert.equal(searchSnapshotSchema.safeParse({startDate:"2026-02-30",endDate:"2026-03-01",impressions:100,clicks:1}).success,false);
  assert.equal(searchSnapshotSchema.safeParse({startDate:"2026-09-01",endDate:"2026-09-02",impressions:1,clicks:2}).success,false);
});
test("contact event requires listing and channel; rejects PII",()=>{
  const e={eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),eventType:"dealer_contact_click"};
  assert.equal(eventSchema.safeParse(e).success,false);
  assert.equal(eventSchema.safeParse({...e,listingId:1,channel:"phone"}).success,true);
  assert.equal(eventSchema.safeParse({...e,listingId:1,channel:"phone",email:"a@example.com"}).success,false);
});
test("API authorization, invalid input, missing storage and safe empty result",async()=>{
  const app=express();app.use(express.json());
  registerGrowthRoutes(app,(req,res,next)=>req.headers["x-admin-token"]==="test"?next():res.sendStatus(401));
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const old=growthStorage.candidates;
  try {
    assert.equal((await fetch(base+"/api/admin/growth-scorecard")).status,401);
    assert.equal((await fetch(base+"/api/admin/growth-scorecard?start=bad&end=bad",{headers:{"x-admin-token":"test"}})).status,400);
    assert.equal((await fetch(base+"/api/valuation/comparables",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,400);
    growthStorage.candidates=async()=>{throw Error("offline");};
    const post=()=>fetch(base+"/api/valuation/comparables",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
    assert.equal((await post()).status,503);
    growthStorage.candidates=async()=>[];
    assert.deepEqual((await (await post()).json()).items,[]);
  }finally{growthStorage.candidates=old;server.close();}
});
