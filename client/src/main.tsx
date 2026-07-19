import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Legacy hash-router redirect: rewrites URLs like `/#/search?brand=ezgo` into
// their clean equivalent `/search?brand=ezgo` before React mounts, so old
// bookmarks, X posts, and backlinks keep working after the BrowserRouter
// migration. Uses history.replaceState so no extra pageview is fired.
if (window.location.hash.startsWith("#/")) {
  const hash = window.location.hash.slice(1); // drop leading '#'
  const [hashPath, hashQuery = ""] = hash.split("?");
  // Prefer any query already on the real URL; otherwise use the hash query.
  const search = window.location.search || (hashQuery ? `?${hashQuery}` : "");
  const clean = `${hashPath}${search}`;
  window.history.replaceState(null, "", clean);
}

createRoot(document.getElementById("root")!).render(<App />);
