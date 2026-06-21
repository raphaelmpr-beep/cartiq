import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { getStoredEmail, setStoredEmail } from "@/lib/userEmail";
import EmailGate from "./EmailGate";
import { apiRequest } from "@/lib/queryClient";

interface SaveButtonProps {
  listingId: number;
  size?: "sm" | "md";
  className?: string;
}

export default function SaveButton({ listingId, size = "md", className = "" }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const email = getStoredEmail();

  useEffect(() => {
    if (!email) return;
    fetch(`/api/saves/status?email=${encodeURIComponent(email)}&listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => { if (d.saved !== undefined) setSaved(d.saved); })
      .catch(() => {});
  }, [email, listingId]);

  async function toggle(resolvedEmail: string) {
    setLoading(true);
    try {
      if (saved) {
        await apiRequest("DELETE", "/api/saves", { email: resolvedEmail, listingId });
        setSaved(false);
      } else {
        await apiRequest("POST", "/api/saves", { email: resolvedEmail, listingId });
        setSaved(true);
      }
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
      toggle(currentEmail);
    }
  }

  const iconSize = size === "sm" ? 14 : 17;
  const btnSize = size === "sm"
    ? "h-7 w-7"
    : "h-9 w-9";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={saved ? "Remove from saved" : "Save this listing"}
        className={`flex items-center justify-center rounded-full border transition-colors ${
          saved
            ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
            : "bg-white border-border text-muted-foreground hover:text-red-400 hover:border-red-200"
        } ${btnSize} ${className}`}
        aria-label={saved ? "Unsave listing" : "Save listing"}
      >
        <Heart size={iconSize} fill={saved ? "currentColor" : "none"} strokeWidth={1.8} />
      </button>

      <EmailGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        action="save this listing"
        onConfirm={(confirmedEmail) => {
          setGateOpen(false);
          toggle(confirmedEmail);
        }}
      />
    </>
  );
}
