import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server-route";
import { buildAccountDeletionPreflight } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function unavailable<T extends NextResponse>(
  applyCookies: (response: T) => T,
) {
  return applyCookies(
    noStore(
      NextResponse.json(
        {
          ok: false,
          reason: "service_unavailable",
          message: "Account-deletion review is temporarily unavailable.",
        },
        { status: 503 },
      ),
    ) as T,
  );
}

export async function GET(request: NextRequest) {
  let route;

  try {
    route = createRouteSupabase(request);
  } catch {
    return noStore(
      NextResponse.json(
        {
          ok: false,
          reason: "service_unavailable",
          message: "Account-deletion review is temporarily unavailable.",
        },
        { status: 503 },
      ),
    );
  }

  const { supabase, applyCookies } = route;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return applyCookies(
      noStore(
        NextResponse.json(
          {
            ok: false,
            reason: "authentication_required",
            message: "Sign in to review account deletion.",
          },
          { status: 401 },
        ),
      ),
    );
  }

  const [
    profileResult,
    rolesResult,
    stationSubmissionsResult,
    stationClaimsOwnedResult,
    stationClaimHistoryResult,
    stationReportHistoryResult,
    businessEnquiriesResult,
    marketplaceSellerResult,
    marketplaceBuyerEnquiriesResult,
    serviceProviderResult,
    serviceCustomerEnquiriesResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("stations")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", user.id),
    supabase
      .from("stations")
      .select("id", { count: "exact", head: true })
      .eq("claimed_by", user.id),
    supabase
      .from("station_claims")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("station_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("business_enquiries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("marketplace_sellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("marketplace_enquiries")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id),
    supabase
      .from("service_providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("service_enquiries")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),
  ]);

  const requiredResults = [
    profileResult,
    rolesResult,
    stationSubmissionsResult,
    stationClaimsOwnedResult,
    stationClaimHistoryResult,
    stationReportHistoryResult,
    businessEnquiriesResult,
    marketplaceSellerResult,
    marketplaceBuyerEnquiriesResult,
    serviceProviderResult,
    serviceCustomerEnquiriesResult,
  ];

  if (requiredResults.some((result) => result.error)) {
    return unavailable(applyCookies);
  }

  let marketplaceListings = 0;

  if (marketplaceSellerResult.data?.id) {
    const result = await supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", marketplaceSellerResult.data.id);

    if (result.error) {
      return unavailable(applyCookies);
    }

    marketplaceListings = result.count ?? 0;
  }

  let serviceOfferings = 0;
  let serviceProviderEnquiries = 0;

  if (serviceProviderResult.data?.id) {
    const [offeringsResult, enquiriesResult] = await Promise.all([
      supabase
        .from("service_offerings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", serviceProviderResult.data.id),
      supabase
        .from("service_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", serviceProviderResult.data.id),
    ]);

    if (offeringsResult.error || enquiriesResult.error) {
      return unavailable(applyCookies);
    }

    serviceOfferings = offeringsResult.count ?? 0;
    serviceProviderEnquiries = enquiriesResult.count ?? 0;
  }

  const preflight = buildAccountDeletionPreflight({
    profileRole: profileResult.data?.role ?? null,
    roles: (rolesResult.data ?? []).map((row) => row.role),
    stationSubmissions: stationSubmissionsResult.count ?? 0,
    stationClaimsOwned: stationClaimsOwnedResult.count ?? 0,
    stationClaimHistory: stationClaimHistoryResult.count ?? 0,
    stationReportHistory: stationReportHistoryResult.count ?? 0,
    businessEnquiries: businessEnquiriesResult.count ?? 0,
    marketplaceSeller: Boolean(marketplaceSellerResult.data),
    marketplaceListings,
    marketplaceBuyerEnquiries:
      marketplaceBuyerEnquiriesResult.count ?? 0,
    serviceProvider: Boolean(serviceProviderResult.data),
    serviceOfferings,
    serviceCustomerEnquiries:
      serviceCustomerEnquiriesResult.count ?? 0,
    serviceProviderEnquiries,
  });

  return applyCookies(noStore(NextResponse.json(preflight)));
}
