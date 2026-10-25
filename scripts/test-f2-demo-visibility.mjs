import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationName = fs
  .readdirSync("supabase/migrations")
  .find(
    name =>
      name.endsWith(
        "_f2_public_demo_visibility_hardening.sql",
      ),
  );

assert.ok(
  migrationName,
  "F2 demo visibility migration must exist",
);

const migration = fs.readFileSync(
  path.join(
    "supabase/migrations",
    migrationName,
  ),
  "utf8",
);

const helper = fs.readFileSync(
  "lib/station-public-visibility.ts",
  "utf8",
);

const home = fs.readFileSync(
  "app/page.tsx",
  "utf8",
);

const stations = fs.readFileSync(
  "app/stations/page.tsx",
  "utf8",
);

const detail = fs.readFileSync(
  "app/stations/[id]/page.tsx",
  "utf8",
);

let passed = 0;

function check(label, fn) {
  fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

check(
  "canonical helper explicitly excludes demo rows",
  () => {
    assert.match(
      helper,
      /station\.is_demo !== false/,
    );
  },
);

check(
  "PostgREST visibility filter excludes demos in both branches",
  () => {
    const matches =
      helper.match(/is_demo\.eq\.false/g) || [];

    assert.equal(matches.length, 2);
  },
);

check(
  "RLS public branch requires is_demo false",
  () => {
    assert.match(
      migration,
      /is_demo = false/,
    );
  },
);

check(
  "private submitter access remains preserved",
  () => {
    assert.match(
      migration,
      /submitted_by = \(select auth\.uid\(\)\)/,
    );
  },
);

check(
  "private claimant access remains preserved",
  () => {
    assert.match(
      migration,
      /claimed_by = \(select auth\.uid\(\)\)/,
    );
  },
);

check(
  "admin private access remains preserved",
  () => {
    assert.match(
      migration,
      /p\.role = 'admin'/,
    );
  },
);

check(
  "nearby query excludes demos",
  () => {
    const nearby =
      migration.match(
        /create or replace function public\.nearby_stations[\s\S]*?comment on function/,
      )?.[0] || "";

    assert.match(
      nearby,
      /s\.is_demo = false/,
    );
  },
);

check(
  "Trip corridor excludes demos",
  () => {
    const trip =
      migration.match(
        /create or replace function public\.trip_route_corridor_stations[\s\S]*?comment on function/,
      )?.[0] || "";

    assert.match(
      trip,
      /s\.is_demo = false/,
    );
  },
);

check(
  "migration performs no station row DML",
  () => {
    assert.doesNotMatch(
      migration,
      /\bdelete\s+from\s+public\.stations\b/i,
    );

    assert.doesNotMatch(
      migration,
      /\binsert\s+into\s+public\.stations\b/i,
    );

    assert.doesNotMatch(
      migration,
      /\bupdate\s+public\.stations\b/i,
    );
  },
);

check(
  "migration does not alter verification state",
  () => {
    assert.doesNotMatch(
      migration,
      /\bset\s+is_verified\b/i,
    );

    assert.doesNotMatch(
      migration,
      /\bset\s+last_verified_at\b/i,
    );
  },
);

check(
  "migration does not alter ownership",
  () => {
    assert.doesNotMatch(
      migration,
      /\bset\s+claimed_by\b/i,
    );
  },
);

check(
  "migration does not alter publication state",
  () => {
    assert.doesNotMatch(
      migration,
      /\bset\s+publication_status\b/i,
    );
  },
);

check(
  "homepage has no built-in demo fallback",
  () => {
    assert.doesNotMatch(
      home,
      /const fallback:Station\[\]/,
    );

    assert.doesNotMatch(
      home,
      /Demo CNG Station -/,
    );
  },
);

check(
  "homepage initializes public station state empty",
  () => {
    assert.match(
      home,
      /useState<Station\[\]>\(\[\]\)/,
    );
  },
);

check(
  "homepage sets successful empty result instead of retaining demos",
  () => {
    assert.match(
      home,
      /setStations\(\(data\|\|\[\]\) as Station\[\]\)/,
    );
  },
);

check(
  "station directory still uses canonical shared filter",
  () => {
    assert.match(
      stations,
      /\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)/,
    );
  },
);

check(
  "station detail still uses canonical shared filter",
  () => {
    assert.match(
      detail,
      /\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)/,
    );
  },
);

check(
  "no production mutation command is introduced",
  () => {
    const combined = [
      migration,
      helper,
      home,
      stations,
      detail,
    ].join("\n");

    assert.doesNotMatch(
      combined,
      /supabase\s+db\s+push|apply_migration|admin_publish_station/,
    );
  },
);

console.log(
  `F2 demo visibility contract passed: ${passed} checks.`,
);
