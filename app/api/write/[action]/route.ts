import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server-route";
import {
  duplicateFingerprint,
  isWriteAction,
  networkFingerprint,
} from "@/lib/security/abuse";

type Payload = Record<string, unknown>;

function text(
  payload: Payload,
  field: string,
  required = true,
) {
  const value = String(payload[field] ?? "").trim();

  if (required && !value) {
    throw new Error(`invalid:${field}`);
  }

  return value;
}

function optionalText(payload: Payload, field: string) {
  const value = String(payload[field] ?? "").trim();
  return value || null;
}

function optionalNumber(payload: Payload, field: string) {
  const raw = payload[field];

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`invalid:${field}`);
  }

  return value;
}

function requiredNumber(payload: Payload, field: string) {
  const value = Number(payload[field]);

  if (!Number.isFinite(value)) {
    throw new Error(`invalid:${field}`);
  }

  return value;
}

function uuid(payload: Payload, field: string) {
  const value = text(payload, field);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new Error(`invalid:${field}`);
  }

  return value;
}

function invalidResponse(field?: string) {
  return NextResponse.json(
    {
      ok: false,
      reason: "invalid_request",
      message: field
        ? `Invalid or missing field: ${field}`
        : "The submission is invalid.",
    },
    { status: 400 }
  );
}

function writeFailure() {
  return NextResponse.json(
    {
      ok: false,
      reason: "write_failed",
      message: "The submission could not be completed.",
    },
    { status: 400 }
  );
}

function stableAbuseReason(value: unknown) {
  if (value === "rate_limited") return "rate_limited";
  if (value === "duplicate") return "duplicate";
  if (value === "temporarily_blocked") return "temporarily_blocked";
  return "temporarily_blocked";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action: rawAction } = await context.params;

  if (!isWriteAction(rawAction)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "unknown_action",
        message: "Unknown submission type.",
      },
      { status: 404 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidResponse();
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidResponse();
  }

  const payload = body as Payload;

  let route;

  try {
    route = createRouteSupabase(request);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "service_unavailable",
        message: "Submission service is temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  const { supabase, applyCookies } = route;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return applyCookies(
      NextResponse.json(
        {
          ok: false,
          reason: "authentication_required",
          message: "Sign in to continue.",
        },
        { status: 401 }
      )
    );
  }

  let networkKey: string;

  try {
    networkKey = networkFingerprint(request);
  } catch {
    return applyCookies(
      NextResponse.json(
        {
          ok: false,
          reason: "service_unavailable",
          message: "Submission security is temporarily unavailable.",
        },
        { status: 503 }
      )
    );
  }

  const duplicateKey = duplicateFingerprint(
    rawAction,
    user.id,
    payload
  );

  const { data: decisionData, error: decisionError } =
    await supabase.rpc("check_write_abuse", {
      p_action: rawAction,
      p_network_key: networkKey,
      p_duplicate_key: duplicateKey,
    });

  if (decisionError) {
    return applyCookies(
      NextResponse.json(
        {
          ok: false,
          reason: "service_unavailable",
          message: "Submission security is temporarily unavailable.",
        },
        { status: 503 }
      )
    );
  }

  const decision = Array.isArray(decisionData)
    ? decisionData[0]
    : decisionData;

  if (!decision?.allowed) {
    const reason = stableAbuseReason(decision?.reason);

    const retry =
      typeof decision?.retry_after_seconds === "number"
        ? Math.max(0, decision.retry_after_seconds)
        : 0;

    const response = NextResponse.json(
      {
        ok: false,
        reason,
        retryAfter: retry,
        message:
          reason === "duplicate"
            ? "This submission was already received recently."
            : reason === "rate_limited"
              ? "Too many submissions. Please try again shortly."
              : "This submission is temporarily blocked.",
      },
      {
        status: reason === "duplicate" ? 409 : 429,
      }
    );

    if (retry > 0) {
      response.headers.set("Retry-After", String(retry));
    }

    return applyCookies(response);
  }

  try {
    switch (rawAction) {
      case "station_report": {
        const stationId = uuid(payload, "station_id");
        const status = text(payload, "status");

        if (
          ![
            "available",
            "low_supply",
            "out_of_gas",
            "offline",
          ].includes(status)
        ) {
          return invalidResponse("status");
        }

        const price = optionalNumber(payload, "price_per_scm");
        const queue = optionalNumber(payload, "queue_minutes");

        if (
          (price !== null && price < 0) ||
          (queue !== null && queue < 0)
        ) {
          return invalidResponse();
        }

        const { error } = await supabase
          .from("station_reports")
          .insert({
            station_id: stationId,
            user_id: user.id,
            status,
            price_per_scm: price,
            queue_minutes: queue,
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "station_claim": {
        const { error } = await supabase
          .from("station_claims")
          .insert({
            station_id: uuid(payload, "station_id"),
            user_id: user.id,
            business_name: text(payload, "business_name"),
            phone: optionalText(payload, "phone"),
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "station_registration": {
        const latitude = requiredNumber(payload, "latitude");
        const longitude = requiredNumber(payload, "longitude");

        if (
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return invalidResponse("coordinates");
        }

        const { error } = await supabase
          .from("stations")
          .insert({
            name: text(payload, "name"),
            operator_name: text(payload, "operator_name"),
            address: text(payload, "address"),
            city: text(payload, "city"),
            state: text(payload, "state"),
            phone: text(payload, "phone"),
            email: text(payload, "email"),
            latitude,
            longitude,
            status: "unknown",
            registration_status: "pending",
            submitted_by: user.id,
            is_verified: false,
            is_demo: false,
            vehicle_compatibility: ["Cars"],
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "marketplace_listing": {
        let { data: seller, error: sellerLookupError } =
          await supabase
            .from("marketplace_sellers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (sellerLookupError) {
          return applyCookies(writeFailure());
        }

        if (!seller) {
          const { data, error } = await supabase
            .from("marketplace_sellers")
            .insert({
              user_id: user.id,
              business_name: text(payload, "business_name"),
              phone: text(payload, "phone"),
              email: text(payload, "email"),
              city: text(payload, "city"),
              state: text(payload, "state"),
            })
            .select("id")
            .single();

          if (error || !data) {
            return applyCookies(writeFailure());
          }

          seller = data;
        }

        const quantity = Math.max(
          1,
          requiredNumber(payload, "quantity")
        );

        const price = optionalNumber(payload, "price");

        if (price !== null && price < 0) {
          return invalidResponse("price");
        }

        const { error } = await supabase
          .from("marketplace_listings")
          .insert({
            seller_id: seller.id,
            title: text(payload, "title"),
            category: text(payload, "category"),
            condition: text(payload, "condition"),
            brand: optionalText(payload, "brand"),
            model: optionalText(payload, "model"),
            description: text(payload, "description"),
            image_url: optionalText(payload, "image_url"),
            certification: optionalText(payload, "certification"),
            quantity,
            city: text(payload, "city"),
            state: text(payload, "state"),
            price,
            price_on_request: price === null,
            status: "pending",
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "marketplace_enquiry": {
        const { error } = await supabase
          .from("marketplace_enquiries")
          .insert({
            listing_id: uuid(payload, "listing_id"),
            buyer_id: user.id,
            message: text(payload, "message"),
            phone: optionalText(payload, "phone"),
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "provider_onboarding": {
        const { error } = await supabase
          .from("service_providers")
          .insert({
            user_id: user.id,
            business_name: text(payload, "business_name"),
            provider_type: text(payload, "provider_type"),
            phone: text(payload, "phone"),
            email: text(payload, "email"),
            address: text(payload, "address"),
            city: text(payload, "city"),
            state: text(payload, "state"),
            description: text(payload, "description"),
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "service_offering": {
        const { data: provider, error: providerError } =
          await supabase
            .from("service_providers")
            .select("id,provider_type")
            .eq("user_id", user.id)
            .maybeSingle();

        if (providerError || !provider) {
          return applyCookies(writeFailure());
        }

        const { error } = await supabase
          .from("service_offerings")
          .insert({
            provider_id: provider.id,
            title: text(payload, "title"),
            category:
              optionalText(payload, "category") ||
              provider.provider_type,
            description: text(payload, "description"),
            status: "pending",
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "service_enquiry": {
        const { error } = await supabase
          .from("service_enquiries")
          .insert({
            provider_id: uuid(payload, "provider_id"),
            offering_id: payload.offering_id
              ? uuid(payload, "offering_id")
              : null,
            customer_id: user.id,
            message: text(payload, "message"),
            phone: optionalText(payload, "phone"),
          });

        if (error) return applyCookies(writeFailure());

        break;
      }

      case "business_enquiry": {
        const fleetSize = optionalNumber(payload, "fleet_size");
        const scm = optionalNumber(
          payload,
          "estimated_daily_scm"
        );

        if (
          (fleetSize !== null && fleetSize < 0) ||
          (scm !== null && scm < 0)
        ) {
          return invalidResponse();
        }

        const { error } = await supabase
          .from("business_enquiries")
          .insert({
            user_id: user.id,
            company_name: text(payload, "company_name"),
            contact_name: text(payload, "contact_name"),
            email: text(payload, "email"),
            phone: text(payload, "phone"),
            enquiry_type: text(payload, "enquiry_type"),
            fleet_size: fleetSize,
            estimated_daily_scm: scm,
            operating_locations:
              optionalText(payload, "operating_locations"),
            message: text(payload, "message"),
          });

        if (error) return applyCookies(writeFailure());

        break;
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("invalid:")
    ) {
      return invalidResponse(error.message.slice(8));
    }

    return applyCookies(writeFailure());
  }

  return applyCookies(
    NextResponse.json({
      ok: true,
      message: "Submission received.",
    })
  );
}
