import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../helpers/run-cli.ts";

test("help shows the expanded command surface and correct API key env var", async () => {
  const result = await runCli(["--help"]);
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.code, 0);
  assert.match(output, /Usage: cartograph/);
  assert.match(output, /\binstall\b/);
  assert.match(output, /\buninstall\b/);
  assert.match(output, /\bdoctor\b/);
  assert.match(output, /\bexport\b/);
  assert.match(output, /\bpacket\b/);
  assert.match(output, /\bmcp\b/);
  assert.match(output, /CARTOGRAPH_API_KEY/);
  assert.doesNotMatch(output, /OPENCODEWIKI_API_KEY/);
});
