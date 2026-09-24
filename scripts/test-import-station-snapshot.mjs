import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildEffectiveRecords,
  summarizeEffectiveRecords,
  classifyRecords,
  assertApplySafety,
  buildSafeReport,
  validateOverlay,
  toInsertPayload,
} from "./import-station-snapshot.mjs";

const snapshotPath = "data/sources/picng-refuelling-stations-2026-09-21.json";
const overlayPath = "data/enrichment/picng-refuelling-stations-location-overlay-2026-09-24.json";
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const overlayText = fs.readFileSync(overlayPath, "utf8");
const overlay = JSON.parse(overlayText);
const effective = buildEffectiveRecords(snapshot, overlay, overlayText);
const summary = summarizeEffectiveRecords(effective);

assert.equal(snapshot.records.length, 90, "immutable snapshot must contain 90 records");
assert.equal(overlay.record_count, 4, "approved overlay must declare 4 records");
assert.deepEqual(summary, { total: 90, coordinates: 4, approximate: 4, exact: 0, unconfirmed: 86 });

const coordinateRows = effective.filter((record) => record.latitude != null);
assert.equal(coordinateRows.length, 4);
for (const record of coordinateRows) {
  assert.equal(record.location_precision, "approximate");
  assert.equal(record.record_source_type, "official_directory");
  assert.equal(record.location_source_type, "other");
  assert.ok(record.location_source_name && record.location_source_url && record.location_source_observed_at);
  assert.equal(record.is_verified, false);
  assert.equal(record.registration_status, "pending");
}
for (const record of effective) {
  assert.equal(record.status, "unknown");
  assert.equal(record.price_per_scm, null);
  assert.equal(record.queue_minutes, null);
  assert.equal(record.open_now, null);
  assert.equal(record.status_updated_at, null);
  assert.equal(record.price_updated_at, null);
  assert.equal(record.queue_updated_at, null);
  assert.equal(record.last_verified_at, null);
  assert.equal(record.is_demo, false);
  assert.equal(record.is_verified, false);
  assert.equal(record.registration_status, "pending");
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectOverlayFailure(mutator, pattern) {
  const candidate = clone(overlay);
  mutator(candidate);
  const raw = JSON.stringify(candidate);
  assert.throws(() => buildEffectiveRecords(snapshot, candidate, raw), pattern);
}
const firstRef = Object.keys(overlay.overlays)[0];
expectOverlayFailure((candidate) => {
  candidate.overlays["picng-ffffffffffffffffffffffff"] = clone(candidate.overlays[firstRef]);
  candidate.record_count += 1;
}, /Unknown overlay source_reference/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].longitude = null; }, /coordinate pair is malformed/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].latitude = 91; }, /Invalid overlay latitude/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].longitude = 181; }, /Invalid overlay longitude/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].operator = "tamper"; }, /Unexpected overlay field 'operator'/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].address = "tamper"; }, /Unexpected overlay field 'address'/);
expectOverlayFailure((candidate) => { candidate.overlays[firstRef].record_source_type = "operator"; }, /Unexpected overlay field 'record_source_type'/);
expectOverlayFailure((candidate) => { candidate.record_count = 999; }, /record_count does not match/);
assert.throws(() => validateOverlay(snapshot, overlay, `{"overlays":{"${firstRef}":{},"${firstRef}":{}},"record_count":2}`), /Duplicate overlay source_reference/);

const firstPlan = classifyRecords(effective, []);
assert.equal(firstPlan.counts.new, 90);
assert.equal(firstPlan.counts.possible_duplicate, 0);
assert.equal(firstPlan.counts.conflict, 0);
assert.equal(firstPlan.counts.invalid, 0);
const identicalExisting = effective.map((record) => ({
  operator_name: record.operator,
  address: record.address,
  state: record.state,
  record_source_type: "official_directory",
  record_source_reference: record.source_reference,
  claimed_by: null,
}));
const secondPlan = classifyRecords(effective, identicalExisting);
assert.equal(secondPlan.counts.unchanged, 90);
assert.equal(secondPlan.counts.new, 0);

const conflictExisting = [{ ...identicalExisting[0], address: "Changed physical identity" }];
const conflictPlan = classifyRecords([effective[0]], conflictExisting);
assert.equal(conflictPlan.counts.conflict, 1);

const duplicateExisting = [{
  operator_name: effective[1].operator,
  address: effective[1].address,
  state: effective[1].state,
  record_source_type: "other",
  record_source_reference: "different-source-reference",
  claimed_by: null,
}];
const duplicatePlan = classifyRecords([effective[1]], duplicateExisting);
assert.equal(duplicatePlan.counts.possible_duplicate, 1);
assert.equal(duplicatePlan.details[0].existing_station_protected, false);

const protectedExisting = [{ ...duplicateExisting[0], claimed_by: "11111111-1111-1111-1111-111111111111" }];
const protectedPlan = classifyRecords([effective[1]], protectedExisting);
assert.equal(protectedPlan.counts.possible_duplicate, 1);
assert.equal(protectedPlan.details[0].existing_station_protected, true);

assert.throws(() => assertApplySafety({ plan: { counts: { ...firstPlan.counts, invalid: 1 } }, overlayCount: 4, expectedNewCount: 90, expectedOverlayCount: 4 }), /invalid records/);
assert.throws(() => assertApplySafety({ plan: { counts: { ...firstPlan.counts, conflict: 1 } }, overlayCount: 4, expectedNewCount: 90, expectedOverlayCount: 4 }), /conflicts exist/);
assert.throws(() => assertApplySafety({ plan: { counts: { ...firstPlan.counts, possible_duplicate: 1 } }, overlayCount: 4, expectedNewCount: 90, expectedOverlayCount: 4 }), /possible duplicates/);
assert.throws(() => assertApplySafety({ plan: firstPlan, overlayCount: 4, expectedNewCount: 89, expectedOverlayCount: 4 }), /expected new count/);
assert.throws(() => assertApplySafety({ plan: firstPlan, overlayCount: 4, expectedNewCount: 90, expectedOverlayCount: 3 }), /expected overlay count/);
assert.doesNotThrow(() => assertApplySafety({ plan: firstPlan, overlayCount: 4, expectedNewCount: 90, expectedOverlayCount: 4 }));

const payload = toInsertPayload(coordinateRows[0]);
assert.equal(payload.status, "unknown");
assert.equal(payload.is_verified, false);
assert.equal(payload.registration_status, "pending");
assert.equal(payload.record_source_type, "official_directory");
assert.equal(payload.location_source_type, "other");

const leakyExisting = [{
  operator_name: effective[2].operator,
  address: effective[2].address,
  state: effective[2].state,
  record_source_type: "other",
  record_source_reference: "other-ref",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  claimed_by: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  submitted_by: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  email: "private@example.com",
  phone: "+234000000000",
}];
const safePlan = classifyRecords([effective[2]], leakyExisting);
const safeReport = buildSafeReport({ mode: "DRY_RUN", snapshotPath, overlayPath, effectiveSummary: summary, plan: safePlan, overlayCount: 4 });
const serialized = JSON.stringify(safeReport);
for (const secret of [leakyExisting[0].id, leakyExisting[0].claimed_by, leakyExisting[0].submitted_by, leakyExisting[0].email, leakyExisting[0].phone, "SUPABASE_SERVICE_ROLE_KEY", "MAPBOX_ACCESS_TOKEN"]) {
  assert.equal(serialized.includes(secret), false, `safe report leaked ${secret}`);
}

console.log("directory importer offline tests: PASS (overlay, provenance, staging, idempotency, fail-closed apply, no-ID reporting)");
