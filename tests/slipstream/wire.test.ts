import test from "node:test";
import assert from "node:assert/strict";
import {
  formatFallback,
  formatSlip,
  parseSlip,
  validateSlip,
} from "../../src/slipstream/wire.ts";

test("formatSlip emits the canonical v3 wire format", () => {
  assert.equal(
    formatSlip("planner", "reviewer", "Request", "Review", ["auth"]),
    "SLIP v3 planner reviewer Request Review auth",
  );
});

test("formatFallback emits a strict fallback wire", () => {
  assert.equal(
    formatFallback("qa", "planner", "ref7f3a"),
    "SLIP v3 qa planner Fallback Generic ref7f3a",
  );
});

test("parseSlip returns structured fallback metadata", () => {
  const message = parseSlip("SLIP v3 qa planner Fallback Generic ref7f3a");

  assert.equal(message.version, "v3");
  assert.equal(message.force, "Fallback");
  assert.equal(message.obj, "Generic");
  assert.equal(message.fallbackRef, "ref7f3a");
  assert.deepEqual(message.payload, []);
});

test("validateSlip reports issues instead of throwing", () => {
  assert.deepEqual(validateSlip("SLIP v3 alice bob Request Review"), []);
  assert.deepEqual(validateSlip("SLIP v3 alice bob Unknown Review"), [
    "Unknown force: 'Unknown'",
  ]);
});
