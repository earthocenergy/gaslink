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
  const [message, setMessage] = useState("");

  async function refresh() {
    const supabase = createClient();
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) setMessage(error.message);
    else setLevel(aal.currentLevel ?? "aal1");
  }

  useEffect(() => { void refresh(); }, []);

  async function enroll() {
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "CNGx Admin" });
    if (error) return setMessage(error.message);
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });
    if (challenge.error) return setMessage(challenge.error.message);
    setChallengeId(challenge.data.id);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) return setMessage(error.message);
    setCode("");
    setQrCode("");
    setMessage("MFA verified for this admin session.");
    await refresh();
  }

  return <main className="panel">
    <h1>Admin security</h1>
    <p>Authenticator assurance: <b>{level}</b></p>
    {level === "aal2" ? <p>Your current session has completed MFA verification.</p> : <>
      <p>Enroll a TOTP authenticator before production enforcement is enabled.</p>
      {!factorId && <button className="primary" onClick={enroll}>Enroll authenticator</button>}
      {qrCode && <div style={{marginTop:16}}><img src={qrCode} alt="CNGx admin MFA QR code" width={220} height={220}/></div>}
      {factorId && challengeId && <form onSubmit={verify} style={{marginTop:16}}>
        <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>
        <button className="primary" type="submit">Verify MFA</button>
      </form>}
    </>}
    {message && <p>{message}</p>}
    <p><Link href="/admin">Return to admin</Link></p>
  </main>;
}
