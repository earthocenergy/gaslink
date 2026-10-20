"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage(){
  const [email,setEmail]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault(); if(busy)return; setBusy(true); setMessage("");
    const redirectTo=`${window.location.origin}/auth/callback?next=/auth/update-password`;
    const {error}=await createClient().auth.resetPasswordForEmail(email,{redirectTo});
    setMessage(error?error.message:"If an account exists for that email, a recovery link has been sent.");
    setBusy(false);
  }
  return <main className="authWrap"><section className="authCard"><h1>Reset password</h1><p className="muted">Enter your account email to receive a recovery link.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?"Sending…":"Send recovery link"}</button></form>{message&&<div className="authMsg">{message}</div>}<p><Link href="/auth">Back to sign in</Link></p></section></main>;
}
