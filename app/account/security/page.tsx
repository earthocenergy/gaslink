"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Action = "local" | "others" | "global" | null;

export default function AccountSecurityPage() {
  const [busy, setBusy] = useState<Action>(null);
  const [message, setMessage] = useState("");

  async function signOutCurrent() {
    if (busy) return;
    setBusy("local");
    setMessage("");

    const { error } = await createClient().auth.signOut({ scope: "local" });

    if (error) {
      setMessage(error.message);
      setBusy(null);
      return;
    }

    location.replace("/auth");
  }

  async function signOutOthers() {
    if (busy) return;
    setBusy("others");
    setMessage("");

    const { error } = await createClient().auth.signOut({ scope: "others" });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Other sessions have been signed out. This session remains active.");
    }

    setBusy(null);
  }

  async function signOutEverywhere() {
    if (busy) return;
    setBusy("global");
    setMessage("");

    const { error } = await createClient().auth.signOut({ scope: "global" });

    if (error) {
      setMessage(error.message);
      setBusy(null);
      return;
    }

    location.replace("/auth");
  }

  return (
    <main className="authWrap">
      <section className="authCard">
        <p><Link href="/dashboard">← Back to account</Link></p>

        <h1>Account security</h1>

        <p className="muted">
          Manage active CNGx sessions if you lose a device, share a browser,
          or believe your credentials may have been compromised.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <button
            type="button"
            className="primary"
            disabled={busy !== null}
            onClick={signOutCurrent}
          >
            {busy === "local" ? "Signing out…" : "Sign out this device"}
          </button>

          <button
            type="button"
            className="secondary"
            disabled={busy !== null}
            onClick={signOutOthers}
          >
            {busy === "others" ? "Revoking…" : "Sign out other sessions"}
          </button>

          <button
            type="button"
            className="secondary"
            disabled={busy !== null}
            onClick={signOutEverywhere}
          >
            {busy === "global" ? "Revoking…" : "Sign out everywhere"}
          </button>
        </div>

        {message && <div className="authMsg">{message}</div>}

        <p className="muted">
          If you suspect your password is compromised, reset it first and then
          use “Sign out everywhere” if you want every session terminated.
        </p>
      </section>
    </main>
  );
}
