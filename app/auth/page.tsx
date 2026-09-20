"use client";
import {FormEvent,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import Link from "next/link";import BackButton from "@/components/BackButton";
export default function AuthPage(){
 const [mode,setMode]=useState<"signin"|"signup">("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMsg("");const s=createClient();
  if(mode==="signup"){const {error}=await s.auth.signUp({email,password,options:{data:{full_name:name}}});setMsg(error?error.message:"Account created. Check your email if confirmation is required.");}
  else {const {error}=await s.auth.signInWithPassword({email,password});if(error)setMsg(error.message);else window.location.href="/dashboard";}
  setBusy(false);
 }
 return <main className="authWrap"><section className="authCard"><BackButton/><div className="brand authBrand"><span className="mark">G</span><div><b>GasLink</b><small>by Earthoc Gas</small></div></div><h1>{mode==="signin"?"Welcome back":"Create your GasLink account"}</h1><p className="muted">Drivers can browse and report station conditions. Approved operators manage their stations.</p><form onSubmit={submit}>{mode==="signup"&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="primary" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button></form>{msg&&<div className="authMsg">{msg}</div>}<button className="switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMsg("")}}>{mode==="signin"?"New to GasLink? Create account":"Already have an account? Sign in"}</button></section></main>
}