import { useState } from "react";
import { X } from "lucide-react";
import { isValidEmail, setStoredEmail } from "@/lib/userEmail";

interface EmailGateProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  action?: string; // e.g. "save this listing" or "watch for price drops"
}

export default function EmailGate({ open, onClose, onConfirm, action = "save and watch listings" }: EmailGateProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setStoredEmail(email);
    onConfirm(email.toLowerCase().trim());
    setEmail("");
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground mb-1">Enter your email</h2>
          <p className="text-sm text-muted-foreground">
            We'll use this to {action}. No password needed — just your email to look up your carts anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="you@email.com"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Continue
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          We don't send marketing email. Your email is only used to retrieve your saved carts and alerts.
        </p>
      </div>
    </div>
  );
}
