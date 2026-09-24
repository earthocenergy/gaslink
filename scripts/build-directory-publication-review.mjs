#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const SOURCE_PATH = path.join(ROOT, "data/sources/picng-refuelling-stations-2026-09-21.json");
export const OVERLAY_PATH = path.join(ROOT, "data/enrichment/picng-refuelling-stations-location-overlay-2026-09-24.json");
export const OUTPUT_PATH = path.join(ROOT, "data/enrichment/picng-publication-review-manifest-2026-09-24.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function buildPublicationReviewManifest(source, overlay) {
  assert(source?.extractable_station_count === 90, "Expected 90 extractable Pi-CNG records.");
  assert(Array.isArray(source?.records) && source.records.length === 90, "Expected exactly 90 Pi-CNG records.");

  const overlays = overlay?.overlays ?? {};
  const overlayEntries = Object.entries(overlays);
  assert(overlay?.record_count === overlayEntries.length, "Overlay record_count must match overlay entries.");
  assert(overlayEntries.length === 4, "Expected exactly four approved coordinate overlays.");

  const seen = new Set();
  const sourceReferences = new Set(source.records.map((record) => record.source_reference));
  for (const [sourceReference, patch] of overlayEntries) {
    assert(sourceReferences.has(sourceReference), `Overlay references unknown source record: ${sourceReference}`);
    assert(Number.isFinite(patch.latitude) && Number.isFinite(patch.longitude), `Overlay coordinates missing: ${sourceReference}`);
    assert(patch.location_precision === "approximate", `Approved overlay must remain approximate: ${sourceReference}`);
    assert(typeof patch.location_source_type === "string" && patch.location_source_type.length > 0, `Coordinate provenance missing: ${sourceReference}`);
  }

  const records = source.records.map((record) => {
    assert(typeof record.source_reference === "string" && record.source_reference.length > 0, "Missing source_reference.");
    assert(!seen.has(record.source_reference), `Duplicate source_reference: ${record.source_reference}`);
    seen.add(record.source_reference);

    const patch = overlays[record.source_reference] ?? null;
    const hasCoordinates = patch !== null;

    if (!hasCoordinates) {
      assert(record.latitude === null && record.longitude === null, `Unconfirmed source record must not contain coordinates: ${record.source_reference}`);
      assert(record.location_precision === "unconfirmed", `Unmapped record must remain unconfirmed: ${record.source_reference}`);
      assert(record.location_source_type === null, `Unmapped record must not invent coordinate provenance: ${record.source_reference}`);
    }

    return {
      source_reference: record.source_reference,
      operator: record.operator,
      address: record.address,
      state: record.state,
      record_source_type: "official_directory",
      has_coordinates: hasCoordinates,
      location_precision: hasCoordinates ? patch.location_precision : record.location_precision,
      location_source_type: hasCoordinates ? patch.location_source_type : record.location_source_type,
      review_track: hasCoordinates ? "mapped_candidate" : "directory_only_candidate",
      publication_status: "unreviewed"
    };
  }).sort((a, b) => a.source_reference.localeCompare(b.source_reference));

  const mappedCandidate = records.filter((record) => record.review_track === "mapped_candidate").length;
  const directoryOnlyCandidate = records.filter((record) => record.review_track === "directory_only_candidate").length;

  return {
    scope: "picng_publication_review_manifest",
    source_snapshot: "data/sources/picng-refuelling-stations-2026-09-21.json",
    coordinate_overlay: "data/enrichment/picng-refuelling-stations-location-overlay-2026-09-24.json",
    note: "Offline review prioritization only; review_track is not a publication recommendation.",
    summary: {
      total: records.length,
      mapped_candidate: mappedCandidate,
      directory_only_candidate: directoryOnlyCandidate,
      unreviewed: records.filter((record) => record.publication_status === "unreviewed").length,
      eligible: records.filter((record) => record.publication_status === "eligible").length,
      published: records.filter((record) => record.publication_status === "published").length,
      withheld: records.filter((record) => record.publication_status === "withheld").length,
      auto_published: 0
    },
    records
  };
}

export function buildPublicationReviewManifestFromFiles(sourcePath = SOURCE_PATH, overlayPath = OVERLAY_PATH) {
  return buildPublicationReviewManifest(readJson(sourcePath), readJson(overlayPath));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const manifest = buildPublicationReviewManifestFromFiles();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(manifest.summary)}\n`);
}
