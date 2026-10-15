import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { compInputSchema, eventSchema, searchSnapshotSchema } from "../shared/growth";
import { selectComparables } from "./comparables";
import { growthStorage } from "./growth-storage";

export function registerGrowthRoutes(app: Express, requireAdmin: RequestHandler) {
  const limit = rateLimit({windowMs:60000, max:60, standardHeaders:true, legacyHeaders:false});
  app.post("/api/valuation/comparables", limit, async (req,res) => {
    const input = compInputSchema.safeParse(req.body);
    if(!input.success) return res.status(400).json({message:"Enter valid cart specifications."});
    try {
      const items = selectComparables(input.data, await growthStorage.candidates());
      res.json({items,status:"ready",message:items.length
        ? "Source-checked dealer asking prices, not completed sale prices. Confirm availability with the dealer."
        : "No recently source-verified close matches. We will not substitute unverified or mismatched carts."});
    } catch {
      res.status(503).json({items:[],status:"unavailable",message:"Verified comparable inventory is temporarily unavailable. Your formula estimate is still shown."});
    }
  });
  app.post("/api/track/growth", limit, async (req,res) => {
    const event = eventSchema.safeParse(req.body);
    if(!event.success) return res.status(400).json({message:"Invalid event"});
    if(/bot|crawler|spider|headless/i.test(req.headers["user-agent"] || "")) return res.status(204).end();
    try { await growthStorage.event(event.data); res.status(204).end(); }
    catch { res.status(503).json({message:"Tracking unavailable"}); }
  });
  app.get("/api/admin/growth-scorecard",requireAdmin,async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    const start = String(req.query.start || ""), end = String(req.query.end || "");
    const validDate = (s:string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
    if(!validDate(start) || !validDate(end) || start>end || Date.parse(end)-Date.parse(start)>90*86400000)
      return res.status(400).json({message:"Choose a valid range of at most 91 days."});
    try {
      res.json(await growthStorage.report(`${start}T00:00:00Z`,new Date(Date.parse(end)+86400000).toISOString()));
    } catch { res.status(503).json({message:"Scorecard unavailable. Apply the growth migration and configure server-only storage; missing data is not zero."}); }
  });
  app.post("/api/admin/growth-search-snapshot", requireAdmin, async(req,res)=>{
    const value=searchSnapshotSchema.safeParse(req.body);
    if(!value.success) return res.status(400).json({message:"Invalid Search Console snapshot"});
    try {await growthStorage.searchSnapshot(value.data);res.json({ok:true});}
    catch {res.status(503).json({message:"Could not save search snapshot"});}
  });
}
