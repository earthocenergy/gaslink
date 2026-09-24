#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const RECORD_SOURCE_TYPE = "official_directory";
export const ALLOWED_PRECISIONS = new Set(["exact", "approximate", "unconfirmed"]);
export const ALLOWED_LOCATION_SOURCE_TYPES = new Set(["official_map", "geocoded", "operator", "admin", "other"]);
export const OVERLAY_FIELDS = new Set([
  "latitude",
  "longitude",
  "location_precision",
  "location_source_type",
  "location_source_name",
  "location_source_url",
  "location_source_observed_at",
]);

export const norm = (value) => String(value ?? "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

export const fingerprint = (record) => [
  norm(record.operator_name ?? record.operator),
  norm(record.address),
  norm(record.state),
].join("|");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function parseIntegerFlag(args, name, { required = false } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) throw new Error(`${name} is required.`);
    return null;
  }
  const raw = args[index + 1];
  assert(raw != null && !raw.startsWith("--"), `${name} requires an integer value.`);
  const value = Number(raw);
  assert(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer.`);
  return value;
}

export function parseCli(argv) {
  const args = argv.slice(2);
  const snapshotPath = args.find((arg, index) => arg.endsWith(".json") && args[index - 1] !== "--overlay")
    ?? "data/sources/picng-refuelling-stations-2026-09-21.json";
  const overlayIndex = args.indexOf("--overlay");
  const overlayPath = overlayIndex === -1 ? null : args[overlayIndex + 1];
  if (overlayIndex !== -1) assert(overlayPath && !overlayPath.startsWith("--"), "--overlay requires a JSON file path.");
  const validateOnly = args.includes("--validate-only");
  const apply = args.includes("--apply");
  assert(!(validateOnly && apply), "--validate-only and --apply cannot be combined.");
  return {
    snapshotPath,
    overlayPath,
    validateOnly,
    apply,
    expectedNewCount: parseIntegerFlag(args, "--expected-new-count", { required: apply }),
    expectedOverlayCount: parseIntegerFlag(args, "--expected-overlay-count", { required: apply }),
  };
}

export function detectDuplicateOverlayReferences(rawText) {
  const matches = [...String(rawText).matchAll(/"(picng-[a-f0-9]{24})"\s*:/gi)].map((match) => match[1]);
  const seen = new Set();
  const duplicates = new Set();
  for (const ref of matches) {
    if (seen.has(ref)) duplicates.add(ref);
    seen.add(ref);
  }
  return [...duplicates];
}

export function validateSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === "object", "Snapshot must be a JSON object.");
  assert(Array.isArray(snapshot.records), "Snapshot records must be an array.");
  const refs = new Set();
  for (const record of snapshot.records) {
    assert(record && typeof record === "object", "Every snapshot record must be an object.");
    assert(record.source_reference, "Every snapshot record requires source_reference.");
    assert(!refs.has(record.source_reference), `Duplicate snapshot source_reference: ${record.source_reference}`);
    refs.add(record.source_reference);
    assert(record.operator && record.address && record.state, `Snapshot identity fields are incomplete for ${record.source_reference}.`);
    assert(ALLOWED_PRECISIONS.has(record.location_precision), `Invalid snapshot location_precision for ${record.source_reference}.`);
    assert((record.latitude == null) === (record.longitude == null), `Snapshot coordinate pair is malformed for ${record.source_reference}.`);
    if (record.latitude != null) {
      assert(Number.isFinite(record.latitude) && record.latitude >= -90 && record.latitude <= 90, `Invalid snapshot latitude for ${record.source_reference}.`);
      assert(Number.isFinite(record.longitude) && record.longitude >= -180 && record.longitude <= 180, `Invalid snapshot longitude for ${record.source_reference}.`);
    }
  }
  if (snapshot.extractable_station_count != null) {
    assert(snapshot.extractable_station_count === snapshot.records.length, "Snapshot extractable_station_count does not match records length.");
  }
  return refs;
}

function overlayEntries(overlay) {
  if (!overlay) return [];
  if (Array.isArray(overlay.overlays)) {
    return overlay.overlays.map((item) => {
      assert(item && typeof item === "object" && item.source_reference, "Array overlay entries require source_reference.");
      const { source_reference, ...patch } = item;
      return [source_reference, patch];
    });
  }
  assert(overlay.overlays && typeof overlay.overlays === "object", "Overlay must contain an overlays object or array.");
  return Object.entries(overlay.overlays);
}

export function validateOverlay(snapshot, overlay, rawOverlayText = "") {
  if (!overlay) return { entries: [], count: 0 };
  const snapshotRefs = validateSnapshot(snapshot);
  const duplicatesFromRaw = detectDuplicateOverlayReferences(rawOverlayText);
  assert(duplicatesFromRaw.length === 0, `Duplicate overlay source_reference(s): ${duplicatesFromRaw.join(", ")}`);
  const entries = overlayEntries(overlay);
  assert(Number.isInteger(overlay.record_count), "overlay.record_count must be an integer.");
  assert(overlay.record_count === entries.length, "overlay.record_count does not match actual overlays.");
  const seen = new Set();
  for (const [sourceReference, patch] of entries) {
    assert(!seen.has(sourceReference), `Duplicate overlay source_reference: ${sourceReference}`);
    seen.add(sourceReference);
    assert(snapshotRefs.has(sourceReference), `Unknown overlay source_reference: ${sourceReference}`);
    assert(patch && typeof patch === "object" && !Array.isArray(patch), `Overlay patch must be an object for ${sourceReference}.`);
    for (const key of Object.keys(patch)) {
      assert(OVERLAY_FIELDS.has(key), `Unexpected overlay field '${key}' for ${sourceReference}.`);
    }
    const { latitude, longitude, location_precision: precision, location_source_type: sourceType } = patch;
    assert((latitude == null) === (longitude == null), `Overlay coordinate pair is malformed for ${sourceReference}.`);
    if (latitude != null) {
      assert(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90, `Invalid overlay latitude for ${sourceReference}.`);
      assert(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180, `Invalid overlay longitude for ${sourceReference}.`);
    }
    assert(ALLOWED_PRECISIONS.has(precision), `Invalid overlay location_precision for ${sourceReference}.`);
    assert(sourceType == null || ALLOWED_LOCATION_SOURCE_TYPES.has(sourceType), `Invalid overlay location_source_type for ${sourceReference}.`);
    if (latitude != null) {
      assert(sourceType, `Coordinate provenance type is required for ${sourceReference}.`);
      assert(patch.location_source_name, `Coordinate provenance name is required for ${sourceReference}.`);
      assert(patch.location_source_url, `Coordinate provenance URL is required for ${sourceReference}.`);
      assert(patch.location_source_observed_at, `Coordinate provenance observed_at is required for ${sourceReference}.`);
    }
  }
  return { entries, count: entries.length };
}

export function buildEffectiveRecords(snapshot, overlay = null, rawOverlayText = "") {
  validateSnapshot(snapshot);
  const { entries } = validateOverlay(snapshot, overlay, rawOverlayText);
  const patches = new Map(entries);
  const records = snapshot.records.map((record) => {
    const patch = patches.get(record.source_reference);
    const base = {
      source_reference: record.source_reference,
      operator: record.operator,
      address: record.address,
      state: record.state,
      latitude: null,
      longitude: null,
      location_precision: "unconfirmed",
      record_source_type: RECORD_SOURCE_TYPE,
      record_source_name: snapshot.source_name ?? null,
      record_source_url: record.source_url ?? snapshot.source_url ?? null,
      record_source_reference: record.source_reference,
      record_source_observed_at: record.source_observed_at ?? snapshot.observed_at ?? null,
      location_source_type: null,
      location_source_name: null,
      location_source_url: null,
      location_source_observed_at: null,
      status: "unknown",
      price_per_scm: null,
      queue_minutes: null,
      open_now: null,
      status_updated_at: null,
      price_updated_at: null,
      queue_updated_at: null,
      last_verified_at: null,
      is_demo: false,
      is_verified: false,
      registration_status: "pending",
    };
    return patch ? { ...base, ...patch } : base;
  });
  return records;
}

export function summarizeEffectiveRecords(records) {
  return records.reduce((summary, record) => {
    summary.total += 1;
    if (record.latitude != null && record.longitude != null) summary.coordinates += 1;
    if (record.location_precision === "approximate") summary.approximate += 1;
    if (record.location_precision === "exact") summary.exact += 1;
    if (record.location_precision === "unconfirmed") summary.unconfirmed += 1;
    return summary;
  }, { total: 0, coordinates: 0, approximate: 0, exact: 0, unconfirmed: 0 });
}

export function toInsertPayload(record) {
  return {
    name: `${record.operator} — ${record.address === "Address pending confirmation" ? record.state : record.address}`,
    operator_name: record.operator,
    address: record.address,
    state: record.state,
    latitude: record.latitude,
    longitude: record.longitude,
    status: "unknown",
    price_per_scm: null,
    queue_minutes: null,
    open_now: null,
    is_demo: false,
    is_verified: false,
    registration_status: "pending",
    record_source_type: RECORD_SOURCE_TYPE,
    record_source_name: record.record_source_name,
    record_source_url: record.record_source_url,
    record_source_reference: record.record_source_reference,
    record_source_observed_at: record.record_source_observed_at,
    location_precision: record.location_precision,
    location_source_type: record.location_source_type,
    location_source_name: record.location_source_name,
    location_source_url: record.location_source_url,
    location_source_observed_at: record.location_source_observed_at,
    status_updated_at: null,
    price_updated_at: null,
    queue_updated_at: null,
    last_verified_at: null,
  };
}

export function classifyRecords(records, existing = []) {
  const stats = { new: 0, possible_duplicate: 0, unchanged: 0, conflict: 0, invalid: 0 };
  const details = [];
  const byRef = new Map();
  const byFingerprint = new Map();
  for (const station of existing) {
    if (station.record_source_reference) {
      byRef.set(`${station.record_source_type ?? ""}|${station.record_source_reference}`, station);
    }
    const key = fingerprint(station);
    if (!byFingerprint.has(key)) byFingerprint.set(key, []);
    byFingerprint.get(key).push(station);
  }

  for (const record of records) {
    const invalid = !record.source_reference || !record.operator || !record.address || !record.state
      || !ALLOWED_PRECISIONS.has(record.location_precision)
      || ((record.latitude == null) !== (record.longitude == null))
      || (record.latitude != null && (!Number.isFinite(record.latitude) || record.latitude < -90 || record.latitude > 90
        || !Number.isFinite(record.longitude) || record.longitude < -180 || record.longitude > 180));
    if (invalid) {
      stats.invalid += 1;
      details.push({ action: "invalid", source_reference: record.source_reference ?? null, reason: "effective_record_validation" });
      continue;
    }

    const exact = byRef.get(`${RECORD_SOURCE_TYPE}|${record.source_reference}`);
    if (exact) {
      const protectedStation = Boolean(exact.claimed_by) || exact.record_source_type === "operator";
      if (fingerprint(exact) === fingerprint(record)) {
        stats.unchanged += 1;
        details.push({ action: "unchanged", source_reference: record.source_reference, normalized_identity_reason: "same official_directory source reference and same normalized operator/address/state", existing_station_protected: protectedStation });
      } else {
        stats.conflict += 1;
        details.push({ action: "conflict", source_reference: record.source_reference, normalized_identity_reason: "same official_directory source reference but normalized station identity changed", existing_station_protected: protectedStation });
      }
      continue;
    }

    const matches = byFingerprint.get(fingerprint(record)) ?? [];
    if (matches.length) {
      const protectedStation = matches.some((station) => Boolean(station.claimed_by) || station.record_source_type === "operator");
      stats.possible_duplicate += 1;
      details.push({ action: "possible_duplicate", source_reference: record.source_reference, normalized_identity_reason: "same normalized operator/address/state with a different or absent source reference", existing_station_protected: protectedStation });
      continue;
    }

    stats.new += 1;
    details.push({ action: "new", source_reference: record.source_reference, normalized_identity_reason: "no exact source-reference or normalized physical identity match", existing_station_protected: false });
  }
  return { counts: stats, details };
}

export function assertApplySafety({ plan, overlayCount, expectedNewCount, expectedOverlayCount }) {
  assert(expectedNewCount != null, "--expected-new-count is required for --apply.");
  assert(expectedOverlayCount != null, "--expected-overlay-count is required for --apply.");
  assert(plan.counts.invalid === 0, "Apply aborted: invalid records exist.");
  assert(plan.counts.conflict === 0, "Apply aborted: conflicts exist.");
  assert(plan.counts.possible_duplicate === 0, "Apply aborted: possible duplicates exist.");
  assert(plan.counts.new === expectedNewCount, `Apply aborted: expected new count ${expectedNewCount}, actual ${plan.counts.new}.`);
  assert(overlayCount === expectedOverlayCount, `Apply aborted: expected overlay count ${expectedOverlayCount}, actual ${overlayCount}.`);
}

export function buildSafeReport({ mode, snapshotPath, overlayPath, effectiveSummary, plan = null, overlayCount }) {
  return {
    mode,
    source: snapshotPath,
    overlay: overlayPath,
    overlay_count: overlayCount,
    effective: effectiveSummary,
    ...(plan ? { counts: plan.counts, details: plan.details } : {}),
    safety: {
      station_row_ids_exposed: false,
      user_ids_exposed: false,
      pii_exposed: false,
      credentials_exposed: false,
    },
  };
}

async function getDatabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) and SUPABASE_SERVICE_ROLE_KEY are required for database dry-run/apply.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchExistingStations(db) {
  const { data, error } = await db.from("stations").select("operator_name,address,state,record_source_type,record_source_reference,claimed_by");
  if (error) throw error;
  return data ?? [];
}

export async function runCli(argv = process.argv) {
  const cli = parseCli(argv);
  const snapshotText = fs.readFileSync(cli.snapshotPath, "utf8");
  const snapshot = JSON.parse(snapshotText);
  const overlayText = cli.overlayPath ? fs.readFileSync(cli.overlayPath, "utf8") : "";
  const overlay = cli.overlayPath ? JSON.parse(overlayText) : null;
  const effective = buildEffectiveRecords(snapshot, overlay, overlayText);
  const effectiveSummary = summarizeEffectiveRecords(effective);
  const overlayCount = overlay ? overlayEntries(overlay).length : 0;

  if (cli.validateOnly) {
    const report = buildSafeReport({ mode: "VALIDATE_ONLY", snapshotPath: cli.snapshotPath, overlayPath: cli.overlayPath, effectiveSummary, overlayCount });
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  const db = await getDatabaseClient();
  const existing = await fetchExistingStations(db);
  const plan = classifyRecords(effective, existing);
  const mode = cli.apply ? "APPLY" : "DRY_RUN";

  if (cli.apply) {
    assertApplySafety({ plan, overlayCount, expectedNewCount: cli.expectedNewCount, expectedOverlayCount: cli.expectedOverlayCount });
    const rows = plan.details
      .filter((detail) => detail.action === "new")
      .map((detail) => effective.find((record) => record.source_reference === detail.source_reference))
      .map(toInsertPayload);
    assert(rows.length === plan.counts.new, "Apply aborted: constructed insert row count does not match planned new count.");
    if (rows.length) {
      const { error } = await db.from("stations").insert(rows);
      if (error) throw error;
    }
  }

  const report = buildSafeReport({ mode, snapshotPath: cli.snapshotPath, overlayPath: cli.overlayPath, effectiveSummary, plan, overlayCount });
  console.log(JSON.stringify(report, null, 2));
  if (!cli.apply) console.error("DRY RUN only. No rows inserted. --apply requires explicit product-lead approval and expected counts.");
  return report;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
