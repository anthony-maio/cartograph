import assert from "node:assert/strict";

export function parseNpmPackResult(output, expectedName, expectedVersion) {
  const parsed = JSON.parse(output);
  // npm 10/11 return an array. npm 12 keys results by package name.
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" ? Object.values(parsed) : [];
  assert.equal(entries.length, 1, "npm pack should return exactly one package");

  const packed = entries[0];
  assert.equal(packed?.name, expectedName, "npm pack returned an unexpected package");
  assert.equal(packed?.version, expectedVersion, "npm pack returned an unexpected version");
  assert.equal(typeof packed.filename, "string", "npm pack should return a tarball filename");
  assert.ok(Array.isArray(packed.files) && packed.files.every((file) => typeof file?.path === "string"), "npm pack should return a file list");
  return packed;
}
