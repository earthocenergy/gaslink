import assert from "node:assert/strict";
import { MapboxRoutingProvider } from "../lib/routing/mapbox.ts";

const originalFetch = globalThis.fetch;
const originalToken = process.env.MAPBOX_ACCESS_TOKEN;
const provider = new MapboxRoutingProvider();

const origin = {
  label: "Lagos",
  coordinate: { longitude: 3.3792, latitude: 6.5244 }
};
const destination = {
  label: "Ibadan",
  coordinate: { longitude: 3.8964, latitude: 7.3775 }
};

let count = 0;

async function check(name, handler, action) {
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("access_token"), "offline-test-token");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return handler(url, options);
  };

  await action(() => calls);
  count++;
  console.log(`PASS ${count}: ${name}`);
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const feature = (coordinates) => ({
  geometry: { coordinates },
  properties: { name: "Test Place" }
});

const validRoute = {
  routes: [{
    geometry: {
      type: "LineString",
      coordinates: [
        [3.3792, 6.5244],
        [3.8964, 7.3775]
      ]
    },
    distance: 130000,
    duration: 7200
  }]
};

try {
  process.env.MAPBOX_ACCESS_TOKEN = "offline-test-token";

  await check(
    "Nigeria-constrained autocomplete",
    (url) => {
      assert.equal(url.searchParams.get("country"), "ng");
      assert.equal(url.searchParams.get("autocomplete"), "true");
      return response({ features: [feature([3.3792, 6.5244])] });
    },
    async () => {
      const places = await provider.searchPlaces("Lagos");
      assert.equal(places.length, 1);
      assert.deepEqual(places[0].coordinate, origin.coordinate);
    }
  );

  await check(
    "short search does not call provider",
    () => { throw new Error("Unexpected HTTP request"); },
    async (calls) => {
      assert.deepEqual(await provider.searchPlaces("ab"), []);
      assert.equal(calls(), 0);
    }
  );

  await check(
    "invalid geocoding coordinates excluded",
    () => response({
      features: [
        feature([181, 6]),
        feature([3, 91]),
        feature(["3", 6]),
        feature([3.3792, 6.5244])
      ]
    }),
    async () => {
      const places = await provider.searchPlaces("Lagos");
      assert.equal(places.length, 1);
    }
  );

  await check(
    "geocoding HTTP failure rejected",
    () => response({ message: "Unavailable" }, 503),
    async () => {
      await assert.rejects(
        provider.searchPlaces("Lagos"),
        /Mapbox place search unavailable/
      );
    }
  );

  await check(
    "exact geocoding disables autocomplete",
    (url) => {
      assert.equal(url.searchParams.get("autocomplete"), "false");
      assert.equal(url.searchParams.get("limit"), "1");
      return response({ features: [feature([3.3792, 6.5244])] });
    },
    async () => {
      assert.deepEqual(
        (await provider.resolvePlace("Lagos")).coordinate,
        origin.coordinate
      );
    }
  );

  await check(
    "empty exact geocoding returns null",
    () => response({ features: [] }),
    async () => {
      assert.equal(await provider.resolvePlace("Unknown Place"), null);
    }
  );

  await check(
    "successful directions normalization",
    (url) => {
      assert.ok(url.pathname.includes("/directions/v5/mapbox/driving/"));
      assert.equal(url.searchParams.get("geometries"), "geojson");
      return response(validRoute);
    },
    async () => {
      const route = await provider.route(origin, destination);
      assert.equal(route.distanceMeters, 130000);
      assert.equal(route.durationSeconds, 7200);
      assert.equal(route.geometry.type, "LineString");
    }
  );

  await check(
    "directions HTTP failure rejected",
    () => response({ message: "Unavailable" }, 503),
    async () => {
      await assert.rejects(
        provider.route(origin, destination),
        /Mapbox directions unavailable/
      );
    }
  );

  for (const [name, body] of [
    ["missing routes", {}],
    ["wrong geometry type", {
      routes: [{
        ...validRoute.routes[0],
        geometry: { type: "Point", coordinates: [3, 6] }
      }]
    }],
    ["insufficient geometry", {
      routes: [{
        ...validRoute.routes[0],
        geometry: {
          type: "LineString",
          coordinates: [[3, 6]]
        }
      }]
    }],
    ["invalid route coordinates", {
      routes: [{
        ...validRoute.routes[0],
        geometry: {
          type: "LineString",
          coordinates: [[3, 6], [181, 7]]
        }
      }]
    }],
    ["missing distance", {
      routes: [{
        ...validRoute.routes[0],
        distance: undefined
      }]
    }]
  ]) {
    await check(
      name,
      () => response(body),
      async () => {
        await assert.rejects(
          provider.route(origin, destination),
          /Malformed Mapbox route/
        );
      }
    );
  }

  await check(
    "negative route distance rejected",
    () => response({
      routes: [{ ...validRoute.routes[0], distance: -100 }]
    }),
    async () => {
      await assert.rejects(
        provider.route(origin, destination),
        /Malformed Mapbox route/
      );
    }
  );


  await check(
    "negative route duration rejected",
    () => response({
      routes: [{ ...validRoute.routes[0], duration: -1 }]
    }),
    async () => {
      await assert.rejects(
        provider.route(origin, destination),
        /Malformed Mapbox route/
      );
    }
  );

  await check(
    "malformed geocoding JSON rejected",
    () => new Response("{invalid-json", { status: 200 }),
    async () => {
      await assert.rejects(provider.searchPlaces("Lagos"));
    }
  );

  await check(
    "malformed directions JSON rejected",
    () => new Response("{invalid-json", { status: 200 }),
    async () => {
      await assert.rejects(provider.route(origin, destination));
    }
  );


  for (const [name, action] of [
    ["autocomplete abort", () => provider.searchPlaces("Lagos")],
    ["exact geocoding abort", () => provider.resolvePlace("Lagos")],
    ["directions abort", () => provider.route(origin, destination)]
  ]) {
    await check(
      name,
      (_url, options) => {
        assert.equal(options.signal.aborted, false);

        // Simulate fetch rejecting because its request was aborted.
        // No network request or actual timeout wait occurs.
        return Promise.reject(
          new DOMException("Request timed out", "TimeoutError")
        );
      },
      async () => {
        await assert.rejects(
          action(),
          error => error?.name === "TimeoutError"
        );
      }
    );
  }


  {
    const originalTimeout = AbortSignal.timeout;
    const deadlines = [];

    try {
      AbortSignal.timeout = (milliseconds) => {
        deadlines.push(milliseconds);
        return originalTimeout(milliseconds);
      };

      await check(
        "provider timeout configuration",
        (url) => {
          if (url.pathname.includes("/directions/"))
            return response(validRoute);

          return response({
            features: [feature([3.3792, 6.5244])]
          });
        },
        async () => {
          await provider.searchPlaces("Lagos");
          await provider.resolvePlace("Lagos");
          await provider.route(origin, destination);

          assert.deepEqual(deadlines, [
            7000,
            7000,
            10000
          ]);
        }
      );
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  }

  console.log(`ALL ${count} MAPBOX HTTP TESTS PASSED`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined)
    delete process.env.MAPBOX_ACCESS_TOKEN;
  else
    process.env.MAPBOX_ACCESS_TOKEN = originalToken;
}
