import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { decideAdminAccess } from "@/lib/security/admin-access";

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

  const { data: { user }, error: userError } =
    await supabase.auth.getUser();

  let profileRole: string | null = null;
  let profileError = false;
  let aalLevel: string | null = null;
  let aalError = false;

  if (!userError && user) {
    const profileResult = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    profileRole = profileResult.data?.role ?? null;
    profileError = Boolean(profileResult.error);

    if (
      !profileError &&
      profileRole === "admin" &&
      ADMIN_MFA_ENFORCEMENT === "required"
    ) {
      const aalResult =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      aalLevel = aalResult.data?.currentLevel ?? null;
      aalError = Boolean(aalResult.error);
    }
  }

  const decision = decideAdminAccess({
    hasUser: Boolean(user),
    userError: Boolean(userError),
    profileRole,
    profileError,
    mfaMode: ADMIN_MFA_ENFORCEMENT,
    aalLevel,
    aalError,
    pathname: request.nextUrl.pathname,
  });

  if (decision.kind === "auth") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("returnTo", safeReturnPath(request));
    return NextResponse.redirect(url);
  }

  if (decision.kind === "dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (decision.kind === "security") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/security";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (decision.kind === "unavailable") {
    return new NextResponse(decision.message, { status: 503 });
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
