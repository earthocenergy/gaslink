import assert from "node:assert/strict";
import fs from "node:fs";
import {
  checkTripRateLimit,
} from "../lib/security/trip-rate-limit.ts";

const originalSecret =
  process.env.ABUSE_FINGERPRINT_SECRET;

process.env.ABUSE_FINGERPRINT_SECRET =
  "offline-test-fingerprint-secret-0123456789abcdef";

let passed = 0;

function check(label, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`PASS ${passed}: ${label}`);
    });
}

function request(headers = {}) {
  return {
    headers: new Headers(headers),
  };
}

try {
  const base = request({
    "x-vercel-forwarded-for": "198.51.100.10",
    "x-forwarded-for": "203.0.113.77",
    "x-real-ip": "203.0.113.88",
  });

  await check(
    "shared backend allowed decision passes",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: [{
              allowed: true,
              retry_after_seconds: null,
            }],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: true,
      });
    },
  );

  await check(
    "shared backend rejection preserves retry",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: [{
              allowed: false,
              retry_after_seconds: 17,
            }],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        retryAfter: 17,
      });
    },
  );

  await check(
    "backend error fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: null,
            error: new Error("backend unavailable"),
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "backend exception fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => {
            throw new Error("backend unavailable");
          },
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "malformed backend response fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "place_resolution",
        {
          userId: null,
          rpc: async () => ({
            data: [{ unexpected: true }],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "empty RPC result fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: [],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "multi-row RPC result fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: [
              {
                allowed: true,
                retry_after_seconds: null,
              },
              {
                allowed: false,
                retry_after_seconds: 5,
              },
            ],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "non-array RPC decision fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: {
              allowed: true,
              retry_after_seconds: null,
            },
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "allowed decision with retry metadata fails closed",
    async () => {
      const result = await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async () => ({
            data: [{
              allowed: true,
              retry_after_seconds: 1,
            }],
            error: null,
          }),
        },
      );

      assert.deepEqual(result, {
        allowed: false,
        unavailable: true,
      });
    },
  );

  await check(
    "rejected decision requires integer retry within one-minute window",
    async () => {
      for (const retry of [0, 61, 1.5]) {
        const result = await checkTripRateLimit(
          base,
          "trip_plan",
          {
            userId: null,
            rpc: async () => ({
              data: [{
                allowed: false,
                retry_after_seconds: retry,
              }],
              error: null,
            }),
          },
        );

        assert.deepEqual(result, {
          allowed: false,
          unavailable: true,
        });
      }
    },
  );

  await check(
    "client-controlled forwarding headers do not affect fingerprint",
    async () => {
      const captures = [];

      const rpc = async args => {
        captures.push(args);

        return {
          data: [{
            allowed: true,
            retry_after_seconds: null,
          }],
          error: null,
        };
      };

      await checkTripRateLimit(
        request({
          "x-vercel-forwarded-for":
            "198.51.100.10",
          "x-forwarded-for":
            "203.0.113.1",
        }),
        "trip_plan",
        {
          userId: null,
          rpc,
        },
      );

      await checkTripRateLimit(
        request({
          "x-vercel-forwarded-for":
            "198.51.100.10",
          "x-forwarded-for":
            "203.0.113.200",
          "x-real-ip":
            "203.0.113.201",
          "cf-connecting-ip":
            "203.0.113.202",
        }),
        "trip_plan",
        {
          userId: null,
          rpc,
        },
      );

      assert.equal(captures.length, 2);

      assert.equal(
        captures[0].p_network_key,
        captures[1].p_network_key,
      );

      assert.equal(
        captures[0].p_subject_key,
        captures[1].p_subject_key,
      );
    },
  );

  await check(
    "authenticated identity receives distinct subject fingerprint",
    async () => {
      const captures = [];

      const rpc = async args => {
        captures.push(args);

        return {
          data: [{
            allowed: true,
            retry_after_seconds: null,
          }],
          error: null,
        };
      };

      await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc,
        },
      );

      await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId:
            "10000000-0000-0000-0000-000000000001",
          rpc,
        },
      );

      assert.equal(
        captures[0].p_network_key,
        captures[1].p_network_key,
      );

      assert.notEqual(
        captures[0].p_subject_key,
        captures[1].p_subject_key,
      );
    },
  );

  await check(
    "fingerprints are fixed 64-character HMAC values",
    async () => {
      let captured;

      await checkTripRateLimit(
        base,
        "trip_plan",
        {
          userId: null,
          rpc: async args => {
            captured = args;

            return {
              data: [{
                allowed: true,
                retry_after_seconds: null,
              }],
              error: null,
            };
          },
        },
      );

      assert.match(
        captured.p_subject_key,
        /^[0-9a-f]{64}$/,
      );

      assert.match(
        captured.p_network_key,
        /^[0-9a-f]{64}$/,
      );
    },
  );

  await check(
    "source requires Vercel-controlled network identity in production",
    () => {
      const source = fs.readFileSync(
        "lib/security/trip-rate-limit.ts",
        "utf8",
      );

      assert.match(
        source,
        /x-vercel-forwarded-for/,
      );

      assert.match(
        source,
        /process\.env\.NODE_ENV === "production"/,
      );

      assert.doesNotMatch(
        source,
        /headers\.get\("x-forwarded-for"\)/,
      );

      assert.doesNotMatch(
        source,
        /headers\.get\("x-real-ip"\)/,
      );

      assert.doesNotMatch(
        source,
        /headers\.get\("cf-connecting-ip"\)/,
      );
    },
  );

  await check(
    "service-role credential remains server-only",
    () => {
      const source = fs.readFileSync(
        "lib/security/trip-rate-limit.ts",
        "utf8",
      );

      assert.match(
        source,
        /SUPABASE_SERVICE_ROLE_KEY/,
      );

      assert.doesNotMatch(
        source,
        /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/,
      );
    },
  );

  await check(
    "process-local counter store is removed",
    () => {
      const source = fs.readFileSync(
        "lib/security/trip-rate-limit.ts",
        "utf8",
      );

      assert.doesNotMatch(
        source,
        /new Map</,
      );

      assert.doesNotMatch(
        source,
        /MAX_KEYS/,
      );
    },
  );

  console.log(
    `ALL ${passed} SHARED TRIP RATE-LIMIT TESTS PASSED`,
  );
} finally {
  if (originalSecret === undefined) {
    delete process.env.ABUSE_FINGERPRINT_SECRET;
  } else {
    process.env.ABUSE_FINGERPRINT_SECRET =
      originalSecret;
  }
}
