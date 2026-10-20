"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminSecurityPage() {
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState("checking");
  const [nextLevel, setNextLevel] = useState("checking");
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();

    const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] =
      await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

    if (aalError) {
      setMessage(aalError.message);
      return;
    }

    if (factorsError) {
      setMessage(factorsError.message);
      return;
    }

    setLevel(aal.currentLevel ?? "aal1");
    setNextLevel(aal.nextLevel ?? "aal1");

    const verifiedTotp = factors.totp.find(
      (factor) => factor.status === "verified"
    );

    setHasVerifiedTotp(Boolean(verifiedTotp));
    setVerifiedFactorId(verifiedTotp?.id ?? "");
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function enroll() {
    if (busy || hasVerifiedTotp) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "CNGx Admin",
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);

    const challenge = await supabase.auth.mfa.challenge({
      factorId: data.id,
    });

    if (challenge.error) {
      setMessage(challenge.error.message);
      setBusy(false);
      return;
    }

    setChallengeId(challenge.data.id);
    setBusy(false);
  }

  async function challengeExistingFactor() {
    if (busy || !verifiedFactorId) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const challenge = await supabase.auth.mfa.challenge({
      factorId: verifiedFactorId,
    });

    if (challenge.error) {
      setMessage(challenge.error.message);
      setBusy(false);
      return;
    }

    setFactorId(verifiedFactorId);
    setChallengeId(challenge.data.id);
    setQrCode("");
    setBusy(false);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();

    if (busy || !factorId || !challengeId) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setCode("");
    setQrCode("");
    setFactorId("");
    setChallengeId("");

    setMessage(
      "MFA verified. This admin session is now AAL2. Other sessions may have been signed out as part of factor verification."
    );

    await refresh();
    setBusy(false);
  }

  return (
    <main className="panel">
      <h1>Admin security</h1>

      <p>
        Current assurance: <b>{level}</b>
      </p>

      <p>
        Next available assurance: <b>{nextLevel}</b>
      </p>

      {level === "aal2" ? (
        <p>Your current admin session has completed MFA verification.</p>
      ) : hasVerifiedTotp ? (
        <>
          <p>
            A verified authenticator is already enrolled for this account.
            Complete MFA verification before accessing protected admin routes.
          </p>

          {!factorId && (
            <button
              className="primary"
              disabled={busy || !verifiedFactorId}
              onClick={challengeExistingFactor}
            >
              {busy ? "Preparing…" : "Verify authenticator"}
            </button>
          )}

          {factorId && challengeId && (
            <form onSubmit={verify} style={{ marginTop: 16 }}>
              <label>
                Authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, ""))
                  }
                />
              </label>

              <button
                className="primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Verifying…" : "Verify MFA"}
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <p>
            Enroll a TOTP authenticator before production MFA enforcement is
            switched from enrolment mode to required mode.
          </p>

          {!factorId && (
            <button
              className="primary"
              disabled={busy}
              onClick={enroll}
            >
              {busy ? "Preparing…" : "Enroll authenticator"}
            </button>
          )}

          {qrCode && (
            <div style={{ marginTop: 16 }}>
              <img
                src={qrCode}
                alt="CNGx admin MFA QR code"
                width={220}
                height={220}
              />
            </div>
          )}

          {factorId && challengeId && (
            <form onSubmit={verify} style={{ marginTop: 16 }}>
              <label>
                Authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, ""))
                  }
                />
              </label>

              <button
                className="primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Verifying…" : "Verify MFA"}
              </button>
            </form>
          )}
        </>
      )}

      {message && <p>{message}</p>}

      <p>
        <Link href="/admin">Return to admin</Link>
      </p>
    </main>
  );
}
