#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  OUTPUT_PATH,
  OVERLAY_PATH,
  SOURCE_PATH,
  buildPublicationReviewManifestFromFiles
} from "./build-directory-publication-review.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

const source = readJson(SOURCE_PATH);
const overlay = readJson(OVERLAY_PATH);
const committed = readJson(OUTPUT_PATH);
const built = buildPublicationReviewManifestFromFiles();

assert.deepEqual(committed, built, "Committed publication manifest must be the deterministic source+overlay build.");
assert.equal(committed.records.length, 90, "Manifest must contain exactly 90 records.");
assert.equal(new Set(committed.records.map((r) => r.source_reference)).size, 90, "Every source_reference must be unique.");
assert.equal(committed.summary.total, 90);
assert.equal(committed.summary.mapped_candidate, 4);
assert.equal(committed.summary.directory_only_candidate, 86);
assert.equal(committed.summary.unreviewed, 90);
assert.equal(committed.summary.eligible, 0);
assert.equal(committed.summary.published, 0);
assert.equal(committed.summary.withheld, 0);
assert.equal(committed.summary.auto_published, 0);

const mapped = committed.records.filter((r) => r.review_track === "mapped_candidate");
const directoryOnly = committed.records.filter((r) => r.review_track === "directory_only_candidate");
assert.equal(mapped.length, 4);
assert.equal(directoryOnly.length, 86);
assert(mapped.every((r) => r.has_coordinates === true && r.location_precision === "approximate"), "All coordinate-bearing review candidates must remain approximate.");
assert(directoryOnly.every((r) => r.has_coordinates === false && r.location_precision === "unconfirmed" && r.location_source_type === null), "Unconfirmed records must receive no invented coordinate state or provenance.");
assert(committed.records.every((r) => r.record_source_type === "official_directory"), "Record provenance must remain official_directory.");
assert(committed.records.every((r) => r.publication_status === "unreviewed"), "review_track must never alter publication_status.");

const overlayRefs = new Set(Object.keys(overlay.overlays));
assert.deepEqual(new Set(mapped.map((r) => r.source_reference)), overlayRefs, "Mapped review candidates must be exactly the independently approved overlay records.");
for (const row of mapped) {
  assert.equal(row.location_source_type, overlay.overlays[row.source_reference].location_source_type, "Coordinate provenance must remain separate and match the overlay.");
}

const sourceByRef = new Map(source.records.map((r) => [r.source_reference, r]));
for (const row of committed.records) {
  const sourceRow = sourceByRef.get(row.source_reference);
  assert(sourceRow, `Source record missing for ${row.source_reference}`);
  assert.equal(row.operator, sourceRow.operator);
  assert.equal(row.address, sourceRow.address);
  assert.equal(row.state, sourceRow.state);
}

const allowedKeys = new Set([
  "source_reference", "operator", "address", "state", "record_source_type",
  "has_coordinates", "location_precision", "location_source_type", "review_track", "publication_status"
]);
for (const row of committed.records) {
  assert.deepEqual(new Set(Object.keys(row)), allowedKeys, "Manifest rows must emit only approved safe review fields.");
}

const forbiddenFields = [
  "id", "latitude", "longitude", "is_verified", "status", "price_per_scm", "queue_minutes",
  "open_now", "last_verified_at", "status_updated_at", "price_updated_at", "queue_updated_at",
  "claimed_by", "submitted_by", "email", "phone", "user_id", "station_id"
];
for (const field of forbiddenFields) {
  assert(!committed.records.some((row) => Object.prototype.hasOwnProperty.call(row, field)), `Manifest must not infer or emit ${field}.`);
}

const serialized = JSON.stringify(committed);
for (const pattern of ["SUPABASE_SERVICE_ROLE_KEY", "sb_secret_", "access_token", "MAPBOX_ACCESS_TOKEN", "eyJ"]) {
  assert(!serialized.includes(pattern), `Manifest must not contain secret/token marker ${pattern}.`);
}
assert(!/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(serialized), "Manifest must not contain database/user UUID identifiers.");

console.log(`publication manifest tests passed: ${JSON.stringify(committed.summary)}`);
