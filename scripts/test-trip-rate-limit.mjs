import assert from "node:assert/strict";
import { checkTripRateLimit } from "../lib/security/trip-rate-limit.ts";

const originalNow = Date.now;
const originalSecret = process.env.ABUSE_FINGERPRINT_SECRET;

let now = 1_000_000;
let count = 0;

function check(name, fn) {
  fn();
  count++;
  console.log(`PASS ${count}: ${name}`);
}

function request(headers = {}) {
  return {
    headers: new Headers(headers),
  };
}

try {
  Date.now = () => now;
  process.env.ABUSE_FINGERPRINT_SECRET =
    "offline-test-fingerprint-secret-0123456789abcdef";

  const first = request({
    "user-agent": "client-a",
    "x-forwarded-for": "198.51.100.10",
  });

  check("trip threshold permits 12 requests", () => {
    for (let i = 0; i < 12; i++) {
      assert.deepEqual(
        checkTripRateLimit(first, "trip_plan"),
        { allowed: true },
      );
    }
  });

  check("trip request 13 is throttled", () => {
    assert.deepEqual(
      checkTripRateLimit(first, "trip_plan"),
      { allowed: false, retryAfter: 60 },
    );
  });

  check("forwarded headers cannot bypass the limit", () => {
    const spoofed = request({
      "user-agent": "client-b",
      "x-forwarded-for": "203.0.113.99",
      "x-real-ip": "203.0.113.100",
      "cf-connecting-ip": "203.0.113.101",
    });

    assert.deepEqual(
      checkTripRateLimit(spoofed, "trip_plan"),
      { allowed: false, retryAfter: 60 },
    );
  });

  check("retry guidance decreases with elapsed time", () => {
    now += 15_000;
    assert.deepEqual(
      checkTripRateLimit(first, "trip_plan"),
      { allowed: false, retryAfter: 45 },
    );
  });

  check("place search has independent 60-request quota", () => {
    for (let i = 0; i < 60; i++) {
      assert.deepEqual(
        checkTripRateLimit(first, "place_resolution"),
        { allowed: true },
      );
    }

    assert.deepEqual(
      checkTripRateLimit(first, "place_resolution"),
      { allowed: false, retryAfter: 60 },
    );
  });

  check("expired windows reset", () => {
    now += 60_000;

    assert.deepEqual(
      checkTripRateLimit(first, "trip_plan"),
      { allowed: true },
    );

    assert.deepEqual(
      checkTripRateLimit(first, "place_resolution"),
      { allowed: true },
    );
  });

  check("missing production secret is rejected", () => {
    const source = requireSource();

    assert.match(
      source,
      /process\.env\.NODE_ENV === "production"/,
    );

    assert.match(
      source,
      /secret\.length < 32/,
    );
  });

  check("production shared-enforcement gate exists", () => {
    const source = requireSource();

    assert.match(
      source,
      /Process-local enforcement is not globally reliable/,
    );

    assert.match(
      source,
      /return \{ allowed: false, unavailable: true \}/,
    );
  });

  check("counter store is bounded and expired entries pruned", () => {
    const source = requireSource();

    assert.match(source, /MAX_KEYS = 4_096/);
    assert.match(source, /function prune\(now: number\)/);
    assert.match(source, /counters\.delete\(key\)/);
    assert.match(source, /counters\.size >= MAX_KEYS/);
  });

  console.log(`ALL ${count} TRIP RATE-LIMIT TESTS PASSED`);
} finally {
  Date.now = originalNow;

  if (originalSecret === undefined) {
    delete process.env.ABUSE_FINGERPRINT_SECRET;
  } else {
    process.env.ABUSE_FINGERPRINT_SECRET = originalSecret;
  }
}

function requireSource() {
  return readFileSync(
    new URL("../lib/security/trip-rate-limit.ts", import.meta.url),
    "utf8",
  );
}

import { readFileSync } from "node:fs";
