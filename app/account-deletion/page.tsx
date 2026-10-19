"use client";

import Link from "next/link";
import { useState } from "react";
import LegalPageShell from "@/components/LegalPageShell";
import {
  ACCOUNT_DELETION_SUPPORT_EMAIL,
  type AccountDeletionPreflightResponse,
} from "@/lib/account-deletion";

type ErrorResponse = {
  ok: false;
  reason: string;
  message: string;
};

export default function AccountDeletionPage() {
  const [result, setResult] =
    useState<AccountDeletionPreflightResponse | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function reviewAccount() {
    if (busy) return;

    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/account/deletion/preflight", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | AccountDeletionPreflightResponse
        | ErrorResponse;

      if (!response.ok || !payload.ok) {
        setError(payload as ErrorResponse);
      } else {
        setResult(payload as AccountDeletionPreflightResponse);
      }
    } catch {
      setError({
        ok: false,
        reason: "service_unavailable",
        message: "Account-deletion review is temporarily unavailable.",
      });
    } finally {
      setBusy(false);
    }
  }

  const supportHref =
    "mailto:" +
    ACCOUNT_DELETION_SUPPORT_EMAIL +
    "?subject=" +
    encodeURIComponent("CNGx account deletion");

  return (
    <LegalPageShell
      title="Account deletion"
      intro="Review what is connected to your CNGx account before deletion. CNGx does not use an unsafe blanket cascade for shared station, marketplace, service or audit records."
    >
      <section>
        <h2>Current deletion stage</h2>
        <p>
          Self-service destructive deletion is not active in this release
          stage. The current control is a read-only preflight that checks the
          account relationships visible through your authenticated CNGx
          session and identifies records that require approved treatment.
        </p>
        <p>
          This page does not delete, anonymise or modify production data.
        </p>
      </section>

      <section>
        <h2>Check your account</h2>
        <p>
          Sign in and run the review to see whether your account has station,
          commercial or service relationships requiring manual review.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={reviewAccount}
          >
            {busy ? "Checking…" : "Check deletion readiness"}
          </button>
          <Link
            className="secondary"
            href="/auth?returnTo=/account-deletion"
          >
            Sign in
          </Link>
        </div>

        {error && (
          <div className="authMsg" role="status">
            {error.message}
          </div>
        )}

        {result && (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <span className="eyebrow">Deletion preflight</span>
              <h3 style={{ marginBottom: 6 }}>Manual review required</h3>
              <p className="muted" style={{ margin: 0 }}>
                Destructive deletion remains disabled. Contract{" "}
                {result.contractVersion}.
              </p>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {result.blockers.map((item) => (
                <div key={item.code}>
                  <b>{item.title}</b>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>Why review can be required</h2>
        <p>
          Station submissions and claims, moderated reports, business
          enquiries, seller or provider records and enquiries shared with
          another party cannot safely be erased by deleting an authentication
          row first. Audit, security, search and Storage relationships also
          need the canonical backend deletion contract before automatic
          deletion is enabled.
        </p>
      </section>

      <section>
        <h2>Request help</h2>
        <p>
          For an account-deletion request or question, contact
          {" "}<a href={supportHref}><b>{ACCOUNT_DELETION_SUPPORT_EMAIL}</b></a>.
          Do not send your password.
        </p>
      </section>
    </LegalPageShell>
  );
}
