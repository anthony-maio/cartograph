import test from "node:test";
import assert from "node:assert/strict";
import { buildSlipA2AMessage, SLIP_A2A_EXTENSION_URI } from "../../src/slipstream/a2a.ts";

test("buildSlipA2AMessage emits text parts and extension metadata", () => {
  const message = buildSlipA2AMessage({
    slipWire: "SLIP v3 planner reviewer Request Review auth",
    ucrVersion: "1.0.0",
    ucrHash: "sha256:abcd",
    confidence: 0.8,
  });

  assert.equal(message.role, "user");
  assert.deepEqual(message.parts, [{ text: "SLIP v3 planner reviewer Request Review auth" }]);
  assert.deepEqual(message.extensions, [SLIP_A2A_EXTENSION_URI]);
  assert.deepEqual(message.metadata?.[SLIP_A2A_EXTENSION_URI], {
    slipVersion: "v3",
    encoding: "force-object",
    ucrVersion: "1.0.0",
    ucrHash: "sha256:abcd",
    confidence: 0.8,
  });
});
