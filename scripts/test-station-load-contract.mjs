import assert from "node:assert/strict";
import fs from "node:fs";
import {
  stationReadIssue,
  stationReadSucceeded,
} from "../lib/station-load-contract.ts";

let count = 0;
function check(name, fn) {
  fn();
  count++;
  console.log(`PASS ${count}: ${name}`);
}

check("successful 200 response is not an error", () => {
  assert.equal(stationReadSucceeded(200, null), true);
  assert.equal(
    stationReadIssue({ target: "directory", status: 200, error: null }),
    null,
  );
});

check("successful empty directory remains a success", () => {
  const data = [];
  assert.equal(stationReadSucceeded(200, null), true);
  assert.equal(data.length, 0);
});

check("successful empty detail remains a legitimate not-found input", () => {
  const data = null;
  assert.equal(stationReadSucceeded(200, null), true);
  assert.equal(data, null);
});

check("genuine detail HTTP 404 maps to not found", () => {
  const issue = stationReadIssue({
    target: "detail",
    status: 404,
    error: { message: "Not Found" },
  });
  assert.equal(issue?.kind, "not_found");
  assert.equal(issue?.retryable, false);
});

check("directory HTTP 404 is not interpreted as an empty directory", () => {
  const issue = stationReadIssue({
    target: "directory",
    status: 404,
    error: { message: "Not Found" },
  });
  assert.equal(issue?.kind, "request");
  assert.equal(issue?.retryable, true);
});

check("malformed detail UUID preserves public not-found behavior", () => {
  const issue = stationReadIssue({
    target: "detail",
    status: 400,
    error: { code: "22P02", message: "invalid input syntax for uuid" },
  });
  assert.equal(issue?.kind, "not_found");
});

check("HTTP 401 is distinct authentication failure", () => {
  assert.equal(
    stationReadIssue({
      target: "directory",
      status: 401,
      error: { message: "Unauthorized" },
    })?.kind,
    "authentication",
  );
});

check("HTTP 403 is distinct authorization failure", () => {
  assert.equal(
    stationReadIssue({
      target: "detail",
      status: 403,
      error: { message: "Forbidden" },
    })?.kind,
    "authorization",
  );
});

check("Postgres permission code is authorization failure", () => {
  assert.equal(
    stationReadIssue({
      target: "detail",
      status: 400,
      error: { code: "42501", message: "permission denied" },
    })?.kind,
    "authorization",
  );
});

check("status-zero fetch failure is a network failure", () => {
  assert.equal(
    stationReadIssue({
      target: "directory",
      status: 0,
      error: { message: "TypeError: Failed to fetch" },
    })?.kind,
    "network",
  );
});

check("thrown fetch failure without status is a network failure", () => {
  assert.equal(
    stationReadIssue({
      target: "detail",
      status: null,
      error: new TypeError("fetch failed"),
    })?.kind,
    "network",
  );
});

check("HTTP 503 is an upstream failure, never empty/not-found", () => {
  const directory = stationReadIssue({
    target: "directory",
    status: 503,
    error: { message: "Service Unavailable" },
  });
  const detail = stationReadIssue({
    target: "detail",
    status: 503,
    error: { message: "Service Unavailable" },
  });
  assert.equal(directory?.kind, "upstream");
  assert.equal(detail?.kind, "upstream");
  assert.equal(directory?.retryable, true);
  assert.equal(detail?.retryable, true);
});

check("HTTP 500 and 429 remain retryable service failures", () => {
  assert.equal(
    stationReadIssue({
      target: "directory",
      status: 500,
      error: { message: "Internal error" },
    })?.kind,
    "upstream",
  );
  assert.equal(
    stationReadIssue({
      target: "directory",
      status: 429,
      error: { message: "Too many requests" },
    })?.kind,
    "upstream",
  );
});

check("ordinary HTTP 400 remains a request failure", () => {
  assert.equal(
    stationReadIssue({
      target: "directory",
      status: 400,
      error: { message: "Bad request" },
    })?.kind,
    "request",
  );
});

const directorySource = fs.readFileSync("app/stations/page.tsx", "utf8");
const detailSource = fs.readFileSync("app/stations/[id]/page.tsx", "utf8");

check("directory consumes status and error before setting station data", () => {
  assert.ok(directorySource.includes("status:result.status"));
  assert.ok(directorySource.includes("error:result.error"));
  assert.ok(directorySource.includes("Retry station directory"));
  assert.ok(!directorySource.includes(
    '.then(({data})=>{setItems((data||[]) as S[]);setLoading(false)}',
  ));
});

check("detail consumes status and error before choosing not-found", () => {
  assert.ok(detailSource.includes('target:"detail",status:result.status,error:result.error'));
  assert.ok(detailSource.includes('loadIssue?.kind==="not_found"'));
  assert.ok(detailSource.includes("Retry station details"));
});

check("report failure is distinct from a successful empty report list", () => {
  assert.ok(detailSource.includes('target:"reports"'));
  assert.ok(detailSource.includes("Retry reports"));
  assert.ok(detailSource.includes("No moderated community reports yet."));
});

check("Candidate A/B public visibility contract remains unchanged", () => {
  for (const source of [directorySource, detailSource]) {
    assert.ok(source.includes("PUBLIC_STATION_VISIBILITY_OR_FILTER"));
  }
});

console.log(
  `Station load/error contract regression passed: ${count} checks.`,
);
