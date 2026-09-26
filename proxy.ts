import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_MFA_ENFORCEMENT = process.env.ADMIN_MFA_ENFORCEMENT ?? "enrolment";

function safeReturnPath(request: NextRequest) {
  const value = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new NextResponse("Admin access is temporarily unavailable.", { status: 503 });
  }

  let response = NextResponse.next();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("returnTo", safeReturnPath(request));
    return NextResponse.redirect(url);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (ADMIN_MFA_ENFORCEMENT === "required") {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) return new NextResponse("Admin MFA verification is temporarily unavailable.", { status: 503 });
    if (aal.currentLevel !== "aal2" && request.nextUrl.pathname !== "/admin/security") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/security";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
