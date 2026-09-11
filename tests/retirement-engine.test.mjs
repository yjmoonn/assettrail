import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const engine = require("../retirement-engine.js");
const input = { ...engine.defaults, currentAge: 55, retireAge: 55, lifeAge: 65,
  monthlySpend: 100, inflationRate: 0, postReturnRate: 0, currentInvestable: 12000 };
const before = JSON.stringify(input);
assert.deepEqual(engine.calculateRetirement(input), {
  firstAnnualSpend: 1200, nestEgg: 12000, gap: 0, yearsToRetire: 0,
  requiredNoContribution: 0, requiredWithContribution: 0
});
assert.deepEqual(engine.buildGoalContext(input), { status: "CONFIGURED",
  yearsToRetirement: 0, fundedRatioPct: 100, requiredAnnualReturnPct: 0 });
assert.equal(JSON.stringify(input), before);
assert.equal(engine.buildGoalContext(engine.defaults).status, "DEFAULT_NOT_CONFIRMED");
assert.equal(engine.isConfigured({ ...engine.defaults, currentAge: "35" }), false);
assert.equal(engine.buildGoalContext({ ...input, lifeAge: 55 }).status, "INVALID");
assert.equal(engine.buildGoalContext({ ...input, currentInvestable: 0 }).requiredAnnualReturnPct, null);
for (const changed of [{ currentAge: 101 }, { retireAge: 54 }, { lifeAge: 121 },
  { currentAge: 1.5 }, { monthlySpend: 0 }, { monthlyInvest: -1 },
  { inflationRate: 21 }, { postReturnRate: -1 }, { currentInvestable: Infinity }]) {
  assert.ok(engine.calculateRetirement({ ...input, ...changed }).error);
}
assert.ok(engine.calculateRetirement(undefined).error);
assert.equal(engine.presentValueGrowingAnnuity(1200, 0.02, 0.02, 10), 12000 / 1.02);
assert.equal(engine.requiredAnnualReturn(0, 0, 100, 120), Infinity);
assert.ok(Math.abs(engine.requiredAnnualReturn(100, 0, 200, 12) - 1) < 1e-10);
assert.ok(Math.abs(engine.requiredAnnualReturn(0, 100, 1200, 12)) < 2e-6);

// The worker API needs no browser, clock, network or user storage.
const context = vm.createContext({});
vm.runInContext(readFileSync("retirement-engine.js", "utf8"), context);
const standalone = context.AssetTrailRetirementEngine;
assert.equal(JSON.stringify(standalone.buildGoalContext(input)), JSON.stringify(engine.buildGoalContext(input)));
assert.ok(Object.isFrozen(engine.defaults));
console.log("retirement engine: deterministic calculation, invalid input and standalone parity passed");
