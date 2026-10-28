import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { analyzeFiles, getFileContent } from "../../src/analyzer.ts";

test("analysis excludes tracked symlinks outside the repo while retaining internal files and links", (t) => {
  const tempParent = fs.realpathSync(os.tmpdir());
  const outer = fs.mkdtempSync(path.join(tempParent, "cartograph-analysis-boundary-"));
  try {
    const repo = path.join(outer, "repo");
    fs.mkdirSync(repo);
    const insideSource = "export const inside = 1;\n";
    fs.writeFileSync(path.join(repo, "dep.ts"), insideSource);
    fs.writeFileSync(path.join(repo, "main.ts"), 'import { inside } from "./dep";\n');
    fs.writeFileSync(
      path.join(outer, "outside.ts"),
      'import secret from "OUTSIDE_IMPORT_CANARY";\nexport const OUTSIDE_EXPORT_CANARY = secret;\n',
    );
    try {
      fs.symlinkSync("dep.ts", path.join(repo, "inside-link.ts"), "file");
      fs.symlinkSync(path.join(outer, "outside.ts"), path.join(repo, "escape.ts"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform === "win32" && (code === "EPERM" || code === "EACCES")) {
        t.skip("Windows file symlink creation requires a privilege unavailable to this process");
        return;
      }
      throw error;
    }
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["-c", "core.symlinks=true", "add", "--", "."], { cwd: repo, stdio: "ignore" });
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf-8" }).split("\0");
    assert.ok(tracked.includes("escape.ts"), "the escaping symlink must be in Git's file list");
    assert.ok(tracked.includes("inside-link.ts"));

    const analysis = analyzeFiles(repo);
    assert.deepEqual(analysis.files.map((file) => file.path).sort(), ["dep.ts", "inside-link.ts", "main.ts"]);
    assert.deepEqual(analysis.edges, [{ from: "main.ts", to: "dep.ts" }]);
    assert.doesNotMatch(JSON.stringify(analysis), /OUTSIDE_(?:IMPORT|EXPORT)_CANARY/);
    assert.equal(getFileContent(repo, "inside-link.ts"), insideSource);
    assert.equal(getFileContent(repo, "escape.ts"), "");
  } finally {
    assert.equal(path.dirname(outer), tempParent);
    assert.ok(path.basename(outer).startsWith("cartograph-analysis-boundary-"));
    fs.rmSync(outer, { recursive: true, force: true });
  }
});
