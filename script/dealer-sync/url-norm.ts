/**
 * JS mirror of DE's `public.gcq_url_norm(text)` (draft-gcq-cos-inputs.sql B1):
 *   nullif(regexp_replace(regexp_replace(lower(regexp_replace(btrim(url), '[?#].*$', '')),
 *          '^https?://(www\.)?', ''), '/+$', ''), '')
 * The table CHECK requires url_norm = gcq_url_norm(url_norm), so this must stay idempotent.
 */
export function gcqUrlNorm(url: string | null | undefined): string | null {
  if (url == null) return null;
  // Postgres btrim() with no chars argument trims spaces only.
  let s = url.replace(/^ +| +$/g, "");
  s = s.replace(/[?#].*$/s, "");
  s = s.toLowerCase();
  s = s.replace(/^https?:\/\/(www\.)?/, "");
  s = s.replace(/\/+$/, "");
  return s === "" ? null : s;
}
