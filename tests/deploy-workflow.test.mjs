import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

assert.match(workflow, /- cron: "40 6 \* \* 1-5"/);
assert.match(workflow, /github\.event_name != 'schedule'[\s\S]*?inputs\.generate_prices == false/);
assert.match(workflow, /needs\.test\.result == 'success' \|\| needs\.test\.result == 'skipped'/);
assert.match(workflow, /for attempt in 1 2 3; do[\s\S]*?python scripts\/generate_prices\.py[\s\S]*?sleep 30/);
assert.match(workflow, /if: steps\.price_mode\.outputs\.generate == 'true'[\s\S]*?name: Generate prices/);
assert.match(workflow, /github\.event_name != 'pull_request'/);

console.log("Deploy workflow scheduling, retries, and CI gates passed.");
