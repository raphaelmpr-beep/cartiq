import { z } from "zod";

export const compInputSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  power: z.enum(["Electric", "Gas"]),
  batteryType: z.enum(["Lithium", "Lead-Acid"]).optional(),
  seating: z.number().int().min(2).max(8),
  state: z.enum(["FL", "GA"]).optional(),
  condition: z.enum(["Excellent", "Good", "Fair", "Poor"]),
});
export type CompInput = z.infer<typeof compInputSchema>;
export interface ComparableCart {
  id: number; slug: string; title: string; askingPrice: number;
  imageUrl: string; city: string; state: string; dealer: string;
  year: number; condition: string; checkedAt: string; sourceUrl: string;
  reasons: string[];
}
export interface CompResponse {
  items: ComparableCart[];
  status: "ready" | "unavailable";
  message: string;
}
export const eventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventType: z.enum(["estimator_view", "estimator_complete", "comps_view", "comp_click", "listing_view", "dealer_contact_click"]),
  listingId: z.number().int().positive().optional(),
  channel: z.enum(["phone", "email", "website"]).optional(),
}).strict().refine(e => !["comp_click", "listing_view", "dealer_contact_click"].includes(e.eventType) || !!e.listingId)
  .refine(e => e.eventType !== "dealer_contact_click" || !!e.channel);
export type GrowthEvent = z.infer<typeof eventSchema>;
export const searchSnapshotSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
}).strict().refine(v => v.startDate <= v.endDate && v.clicks <= v.impressions &&
  [v.startDate, v.endDate].every(d => Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d));
