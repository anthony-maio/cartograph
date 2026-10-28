import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/run-cli.ts";

test("static CLI context locates a late implementation and reports exact source lines", async () => {
  const tempParent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempParent, "cartograph-static-excerpt-"));
  try {
    const repo = path.join(root, "repo");
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.mkdirSync(path.join(repo, "tests"));
    const lines = [
      'import { knownIssuers } from "./settings";',
      ...Array.from({ length: 300 }, (_, index) => `// unrelated route ${index}`),
      "export function validateCredential(credential) {",
      '  if (!knownIssuers.includes(credential.issuer)) throw new Error("Unknown credential issuer");',
      '  if (credential.expired) throw new Error("Credential expiry is rejected");',
      "  return credential;",
      "}",
      ...Array.from({ length: 90 }, (_, index) => `// unrelated handler ${index}`),
    ];
    fs.writeFileSync(path.join(repo, "src/router.ts"), lines.join("\n"));
    fs.writeFileSync(path.join(repo, "src/settings.ts"), 'export const knownIssuers = ["local"];\n');
    fs.writeFileSync(path.join(repo, "tests/router.test.ts"), 'import { validateCredential } from "../src/router";\n');
    const result = await runCli([
      "context", repo, "--static", "--json", "--top", "6",
      "--task", "Reject unknown credential issuers and credential expiry in router",
    ], { CARTOGRAPH_CACHE_DIR: path.join(root, "cache"), CARTOGRAPH_API_KEY: "" });
    assert.equal(result.code, 0, result.stderr);
    const context = JSON.parse(result.stdout);
    const selected = context.files.find((file: { path: string }) => file.path === "src/router.ts");
    assert.ok(selected);
    assert.ok(context.files.some((file: { path: string }) => file.path === "tests/router.test.ts"));
    assert.ok(selected.startLine > 200);
    assert.ok(selected.endLine - selected.startLine + 1 <= 80);
    assert.equal(selected.truncated, true);
    assert.match(selected.content, /Unknown credential issuer/);
    assert.match(selected.content, /Credential expiry is rejected/);
    assert.equal(selected.content, lines.slice(selected.startLine - 1, selected.endLine).join("\n"));
  } finally {
    assert.equal(path.dirname(root), tempParent);
    assert.ok(path.basename(root).startsWith("cartograph-static-excerpt-"));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
