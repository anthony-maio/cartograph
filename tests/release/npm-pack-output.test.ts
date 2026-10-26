import test from "node:test";
import assert from "node:assert/strict";
import { parseNpmPackResult } from "../../scripts/npm-pack-result.mjs";

const packed = {
  name: "@anthony-maio/cartograph",
  version: "1.2.1",
  filename: "anthony-maio-cartograph-1.2.1.tgz",
  files: [{ path: "dist/cli.cjs" }, { path: "dist/mcp.cjs" }],
};
const parse = (result: unknown) => parseNpmPackResult(JSON.stringify(result), packed.name, packed.version);

test("npm pack accepts the array output from npm 10 and 11", () => {
  assert.deepEqual(parse([packed]), packed);
});

test("npm pack accepts the package-keyed output from npm 12", () => {
  assert.deepEqual(parse({ [packed.name]: packed }), packed);
});

test("npm pack rejects a different package or version", () => {
  assert.throws(() => parse([{ ...packed, name: "unrelated-package" }]), /unexpected package/);
  assert.throws(() => parse({ [packed.name]: { ...packed, version: "0.0.0" } }), /unexpected version/);
});

test("npm pack rejects missing or ambiguous package metadata", () => {
  assert.throws(() => parse(null), /exactly one package/);
  assert.throws(() => parse([packed, packed]), /exactly one package/);
  assert.throws(() => parse({ error: { code: "EFAIL" } }), /unexpected package/);
  assert.throws(() => parse([{ ...packed, files: null }]), /file list/);
});
