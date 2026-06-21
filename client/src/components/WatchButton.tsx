import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { getStoredEmail } from "@/lib/userEmail";
import EmailGate from "./EmailGate";
import { apiRequest } from "@/lib/queryClient";

interface WatchButtonProps {
  listingId: number;
  size?: "sm" | "md";
  className?: string;
}

export default function WatchButton({ listingId, size = "md", className = "" }: WatchButtonProps) {
  const [watching, setWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const email = getStoredEmail();

  useEffect(() => {
    if (!email) return;
    fetch(`/api/watches/status?email=${encodeURIComponent(email)}&listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => { if (d.watching !== undefined) setWatching(d.watching); })
      .catch(() => {});
  }, [email, listingId]);

  async function startWatch(resolvedEmail: string) {
    setLoading(true);
    try {
      const res: any = await apiRequest("POST", "/api/watches", { email: resolvedEmail, listingId });
      if (res?.id) setWatchId(res.id);
      setWatching(true);
    } catch {}
    setLoading(false);
  }

  async function stopWatch(resolvedEmail: string) {
    setLoading(true);
    try {
      if (watchId) {
        await apiRequest("DELETE", `/api/watches/${watchId}?email=${encodeURIComponent(resolvedEmail)}`, {});
      }
      setWatching(false);
      setWatchId(null);
    } catch {}
    setLoading(false);
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const currentEmail = getStoredEmail();
    if (!currentEmail) {
      setGateOpen(true);
    } else {
      watching ? stopWatch(currentEmail) : startWatch(currentEmail);
    }
  }

  const iconSize = size === "sm" ? 14 : 17;
  const btnSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={watching ? "Stop watching for price drops" : "Watch for price drops"}
        className={`flex items-center justify-center rounded-full border transition-colors ${
          watching
            ? "bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100"
            : "bg-white border-border text-muted-foreground hover:text-amber-500 hover:border-amber-300"
        } ${btnSize} ${className}`}
        aria-label={watching ? "Stop watching" : "Watch for price drops"}
      >
        {watching
          ? <Bell size={iconSize} fill="currentColor" strokeWidth={1.8} />
          : <BellOff size={iconSize} strokeWidth={1.8} />}
      </button>

      <EmailGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        action="get notified when this price drops"
        onConfirm={(confirmedEmail) => {
          setGateOpen(false);
          startWatch(confirmedEmail);
        }}
      />
    </>
  );
}
