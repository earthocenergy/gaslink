"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage(){
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault(); if(busy)return; setBusy(true); setMessage("");
    const {error}=await createClient().auth.updateUser({password});
    if(error)setMessage(error.message); else {setMessage("Password updated. Redirecting…"); setTimeout(()=>location.replace("/dashboard"),500)}
    setBusy(false);
  }
  return <main className="authWrap"><section className="authCard"><h1>Choose a new password</h1><form onSubmit={submit}><label>New password<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?"Updating…":"Update password"}</button></form>{message&&<div className="authMsg">{message}</div>}</section></main>;
}
