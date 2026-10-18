// Build-time flag injected by vite.config.ts `define` from LEAD_TRACKING_ENABLED
// (default false). When false, every lead-tracking branch is constant-folded away
// and the built client is byte-identical to main.
declare const __LEAD_TRACKING_ENABLED__: boolean;
