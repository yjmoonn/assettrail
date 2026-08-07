import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "assettrail-tickers-"));
const file = join(directory, "tickers.json");
await writeFile(file, `${JSON.stringify({ KRX: [], US: ["AAPL"] }, null, 2)}\n`);

function run(args) {
  return spawnSync(process.execPath, ["scripts/manage_us_tickers.mjs", ...args, "--file", file], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

const review = run(["review", "--ticker", "aapl"]);
assert.equal(review.status, 0);
assert.equal(JSON.parse(review.stdout).exists, true);

const dryRun = run(["add", "--ticker", "MSFT", "--reason", "가격 대상 검토"]);
assert.equal(dryRun.status, 0);
assert.equal(JSON.parse(dryRun.stdout).changed, false);
assert.deepEqual(JSON.parse(await readFile(file, "utf8")).US, ["AAPL"]);

const applied = run(["add", "--ticker", "MSFT", "--reason", "가격 대상 검토", "--apply"]);
assert.equal(applied.status, 0);
assert.equal(JSON.parse(applied.stdout).changed, true);
assert.deepEqual(JSON.parse(await readFile(file, "utf8")).US, ["AAPL", "MSFT"]);

const duplicate = run(["add", "--ticker", "msft", "--reason", "중복 확인", "--apply"]);
assert.equal(duplicate.status, 0);
assert.equal(JSON.parse(duplicate.stdout).changed, false);

const invalid = run(["add", "--ticker", "../../bad", "--reason", "차단"]);
assert.notEqual(invalid.status, 0);
assert.match(invalid.stderr, /US 티커/);

console.log("manage-us-tickers tests passed");
