import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Legacy /#/foo → /foo redirect shim.
// Preserves old shared links from the pre-history-routing era.
if (typeof window !== "undefined" && window.location.hash.startsWith("#/")) {
  const hashPath = window.location.hash.slice(1); // "#/foo?x=1" → "/foo?x=1"
  const target = hashPath + (hashPath.includes("?") ? "" : window.location.search);
  window.history.replaceState(null, "", target);
}

createRoot(document.getElementById("root")!).render(<App />);
