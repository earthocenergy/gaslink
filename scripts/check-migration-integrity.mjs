import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "docs", "production-migration-ledger.json");

const files = fs.readdirSync(dir)
  .filter((x) => x.endsWith(".sql"))
  .sort();

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(dir, file)))
    .digest("hex");

/*
 * Production ledger integrity.
 */
const productionVersions = ledger.migrations.map((x) => x.version);
const duplicateProductionVersions = productionVersions.filter(
  (v, i) => productionVersions.indexOf(v) !== i
);

if (duplicateProductionVersions.length) {
  fail(
    `Duplicate production migration versions in ledger: ${
      [...new Set(duplicateProductionVersions)].join(", ")
    }`
  );
}

if (ledger.head !== ledger.migrations.at(-1)?.version) {
  fail("Production migration head does not match ledger tail");
}

/*
 * Repository timestamp integrity.
 */
const timestamped = files
  .map((file) => ({
    file,
    match: file.match(/^(\d{14})_(.+)\.sql$/)
  }))
  .filter((x) => x.match);

const repositoryVersions = timestamped.map((x) => x.match[1]);

const duplicateRepositoryVersions = repositoryVersions.filter(
  (v, i) => repositoryVersions.indexOf(v) !== i
);

if (duplicateRepositoryVersions.length) {
  fail(
    `Duplicate repository migration versions: ${
      [...new Set(duplicateRepositoryVersions)].join(", ")
    }`
  );
}

/*
 * Protect all known repository migration sources against silent edits,
 * deletion, or rename.
 */
const lockedSources = ledger.lockedRepositorySources || [];

const lockedFiles = lockedSources.map((x) => x.file);
const duplicateLockedFiles = lockedFiles.filter(
  (f, i) => lockedFiles.indexOf(f) !== i
);

if (duplicateLockedFiles.length) {
  fail(
    `Duplicate locked migration source entries: ${
      [...new Set(duplicateLockedFiles)].join(", ")
    }`
  );
}

for (const source of lockedSources) {
  if (!files.includes(source.file)) {
    fail(`Locked migration source missing or renamed: ${source.file}`);
  }

  const actualHash = sha256(source.file);

  if (actualHash !== source.sha256) {
    fail(
      `Locked migration source changed: ${source.file}\n` +
      `expected ${source.sha256}\n` +
      `actual   ${actualHash}`
    );
  }
}

/*
 * Exact production-version matches must also retain the production
 * migration name, not merely the timestamp.
 */
const prodByVersion = new Map(
  ledger.migrations.map((x) => [x.version, x])
);

for (const item of timestamped) {
  const [version, name] = [item.match[1], item.match[2]];
  const production = prodByVersion.get(version);

  if (production && production.name !== name) {
    fail(
      `Ledger/source name mismatch for ${version}: ` +
      `repository=${name}, production=${production.name}`
    );
  }
}

/*
 * Validate documented logical/version mismatches.
 */
const logicalMismatches = ledger.knownLogicalVersionMismatches || [];
const allowedMismatchFiles = new Set(
  logicalMismatches.map((x) => x.repository)
);

for (const mismatch of logicalMismatches) {
  if (!files.includes(mismatch.repository)) {
    fail(
      `Documented logical migration source missing or renamed: ` +
      mismatch.repository
    );
  }

  const match = mismatch.production.match(/^(\d{14})_(.+)$/);

  if (!match) {
    fail(
      `Invalid production mapping format for ${mismatch.repository}: ` +
      mismatch.production
    );
  }

  const [, productionVersion, productionName] = match;
  const production = prodByVersion.get(productionVersion);

  if (!production) {
    fail(
      `Logical mismatch references unknown production version: ` +
      mismatch.production
    );
  }

  if (production.name !== productionName) {
    fail(
      `Logical mismatch production name differs from ledger: ` +
      mismatch.production
    );
  }
}

/*
 * A timestamped repository migration must either correspond exactly to a
 * production ledger version or be one of the explicitly documented
 * logical mismatch files.
 */
const productionHead = ledger.head;

const unexpected = timestamped.filter(
  (x) =>
    !prodByVersion.has(x.match[1]) &&
    !allowedMismatchFiles.has(x.file) &&
    x.match[1] <= productionHead
);

const forwardMigrations = timestamped.filter(
  (x) =>
    !prodByVersion.has(x.match[1]) &&
    !allowedMismatchFiles.has(x.file) &&
    x.match[1] > productionHead
);

const pendingSources = ledger.pendingRepositorySources || [];
const pendingFiles = pendingSources.map((x) => x.file).sort();
const forwardFiles = forwardMigrations.map((x) => x.file).sort();

if (JSON.stringify(pendingFiles) !== JSON.stringify(forwardFiles)) {
  fail(
    `pendingRepositorySources differs from unapplied forward migrations`
  );
}

const duplicatePendingFiles = pendingFiles.filter(
  (file, index) => pendingFiles.indexOf(file) !== index
);

if (duplicatePendingFiles.length) {
  fail(
    `Duplicate pending migration source entries: ${
      [...new Set(duplicatePendingFiles)].join(", ")
    }`
  );
}

for (const source of pendingSources) {
  if (!files.includes(source.file)) {
    fail(`Pending migration source missing or renamed: ${source.file}`);
  }

  const actualHash = sha256(source.file);

  if (actualHash !== source.sha256) {
    fail(
      `Pending migration source changed: ${source.file}\n` +
      `expected ${source.sha256}\n` +
      `actual   ${actualHash}`
    );
  }
}

if (unexpected.length) {
  fail(
    `Repository migrations absent from recorded production ledger: ` +
    unexpected.map((x) => x.file).join(", ")
  );
}

/*
 * Confirm exact-match inventory recorded by the ledger.
 */
const computedExactVersions = repositoryVersions
  .filter((version) => prodByVersion.has(version))
  .sort();

const recordedExactVersions = [
  ...(ledger.repositoryExactVersionMatches || [])
].sort();

if (
  JSON.stringify(computedExactVersions) !==
  JSON.stringify(recordedExactVersions)
) {
  fail(
    `repositoryExactVersionMatches differs from computed repository state`
  );
}

/*
 * Confirm historical source-gap count.
 */
const missingProductionSources = ledger.migrations.filter(
  (x) => !repositoryVersions.includes(x.version)
);

if (
  missingProductionSources.length !==
  ledger.missingProductionSourceVersionCount
) {
  fail(
    `Ledger missing-source count ${ledger.missingProductionSourceVersionCount} ` +
    `!= computed ${missingProductionSources.length}`
  );
}

/*
 * The live migration head must have an exact, locked repository source.
 */
const head = ledger.migrations.at(-1);
const expectedHeadFile = `${head.version}_${head.name}.sql`;

if (!files.includes(expectedHeadFile)) {
  fail(`Production migration head source missing: ${expectedHeadFile}`);
}

if (!lockedFiles.includes(expectedHeadFile)) {
  fail(`Production migration head source is not hash-locked: ${expectedHeadFile}`);
}

console.log(
  `Migration integrity OK: ` +
  `${ledger.migrations.length} production, ` +
  `${files.length} repository files, ` +
  `${computedExactVersions.length} exact version matches, ` +
  `${missingProductionSources.length} production versions without exact repository source, ` +
  `${forwardMigrations.length} unapplied forward migrations, ` +
  `${pendingSources.length} pending source hashes, ` +
  `${lockedSources.length} applied source hashes.`
);
