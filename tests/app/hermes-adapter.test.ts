import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { hermesAdapter } from "../../src/app/adapters/hermes.ts";

function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cartograph-hermes-adapter-"));
  const packageRoot = path.join(root, "package with spaces");
  const targetRoot = path.join(root, "hermes profile");
  const pluginRoot = path.join(targetRoot, "plugins", "cartograph");
  fs.mkdirSync(path.join(packageRoot, "dist"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "assets", "hermes"), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, "dist", "cli.cjs"), "process.stdout.write('{}');\n");
  fs.writeFileSync(path.join(packageRoot, "assets", "hermes", "plugin.yaml"), "name: cartograph\nversion: 1.0.0\n");
  fs.writeFileSync(path.join(packageRoot, "assets", "hermes", "__init__.py"), "def register(ctx):\n    pass\n");
  return {
    root, packageRoot, targetRoot, pluginRoot,
    context: { packageRoot, env: { CARTOGRAPH_HERMES_HOME: targetRoot } },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("Hermes profile overrides are explicit and preserve their precedence", () => {
  const home = path.resolve("fixture-home");
  assert.equal(hermesAdapter.resolveTargetRoot({ USERPROFILE: home }), path.join(home, ".hermes"));
  assert.equal(hermesAdapter.resolveTargetRoot({ USERPROFILE: home, HERMES_HOME: path.join(home, "profile") }), path.join(home, "profile"));
  assert.equal(hermesAdapter.resolveTargetRoot({ HERMES_HOME: path.join(home, "profile"), CARTOGRAPH_HERMES_HOME: path.join(home, "override") }), path.join(home, "override"));
});

test("Hermes installs the bound runtime, repairs missing files, and preserves host configuration", () => {
  const f = fixture();
  try {
    fs.mkdirSync(f.targetRoot, { recursive: true });
    const config = path.join(f.targetRoot, "config.yaml");
    fs.writeFileSync(config, "plugins:\n  enabled: [existing]\n");
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    const installed = hermesAdapter.install(f.context);
    assert.equal(installed.targetRoot, f.targetRoot);
    assert.equal(installed.installedPaths.length, 4);
    const runtimePath = path.join(f.pluginRoot, "runtime.json");
    assert.deepEqual(JSON.parse(fs.readFileSync(runtimePath, "utf8")), {
      node: process.execPath,
      cli: path.join(f.packageRoot, "dist", "cli.cjs"),
      cache_dir: path.join(f.targetRoot, "cache", "cartograph"),
    });
    assert.equal(hermesAdapter.doctor(f.context).installed, true);
    assert.deepEqual(hermesAdapter.doctor(f.context).issues, []);
    fs.unlinkSync(runtimePath);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    hermesAdapter.install(f.context);
    assert.equal(hermesAdapter.doctor(f.context).installed, true);
    assert.equal(fs.readFileSync(config, "utf8"), "plugins:\n  enabled: [existing]\n");
    hermesAdapter.uninstall(f.context);
    assert.equal(fs.existsSync(f.pluginRoot), false);
    assert.equal(fs.readFileSync(config, "utf8"), "plugins:\n  enabled: [existing]\n");
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    assert.deepEqual(hermesAdapter.uninstall(f.context).installedPaths, []);
  } finally {
    f.cleanup();
  }
});

test("Hermes reinstall and uninstall preserve user additions and cached source", () => {
  const f = fixture();
  try {
    hermesAdapter.install(f.context);
    const userFile = path.join(f.pluginRoot, "notes.txt");
    const cache = path.join(f.targetRoot, "cache", "cartograph", "saved-source.json");
    fs.writeFileSync(userFile, "user additions");
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, "saved source");
    hermesAdapter.install(f.context);
    hermesAdapter.uninstall(f.context);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    assert.equal(fs.readFileSync(userFile, "utf8"), "user additions");
    assert.equal(fs.readFileSync(cache, "utf8"), "saved source");
    hermesAdapter.install(f.context);
    assert.equal(hermesAdapter.doctor(f.context).installed, true);
    assert.equal(fs.readFileSync(userFile, "utf8"), "user additions");
  } finally {
    f.cleanup();
  }
});

test("Hermes refuses an existing plugin directory without its ownership record", () => {
  const f = fixture();
  try {
    fs.mkdirSync(f.pluginRoot, { recursive: true });
    const existing = path.join(f.pluginRoot, "__init__.py");
    fs.writeFileSync(existing, "existing plugin");
    assert.throws(() => hermesAdapter.install(f.context), /unowned Hermes plugin directory/);
    assert.throws(() => hermesAdapter.uninstall(f.context), /unowned Hermes plugin directory/);
    assert.equal(fs.readFileSync(existing, "utf8"), "existing plugin");
    assert.deepEqual(fs.readdirSync(f.pluginRoot), ["__init__.py"]);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
  } finally {
    f.cleanup();
  }
});

test("Hermes upgrades replace managed files without modifying hard-linked copies", () => {
  const f = fixture();
  try {
    hermesAdapter.install(f.context);
    const installed = path.join(f.pluginRoot, "__init__.py");
    const preserved = path.join(f.root, "preserved-plugin.py");
    const original = fs.readFileSync(installed, "utf8");
    fs.linkSync(installed, preserved);
    fs.writeFileSync(path.join(f.packageRoot, "assets", "hermes", "__init__.py"), "# upgraded plugin\n");
    hermesAdapter.install(f.context);
    assert.equal(fs.readFileSync(preserved, "utf8"), original);
    assert.equal(fs.readFileSync(installed, "utf8"), "# upgraded plugin\n");
    assert.equal(hermesAdapter.doctor(f.context).installed, true);
  } finally {
    f.cleanup();
  }
});

test("Hermes preserves locally modified managed files", () => {
  const f = fixture();
  try {
    hermesAdapter.install(f.context);
    const changed = path.join(f.pluginRoot, "__init__.py");
    fs.appendFileSync(changed, "# local customization\n");
    assert.throws(() => hermesAdapter.install(f.context), /Preserving a modified Hermes plugin file/);
    assert.throws(() => hermesAdapter.uninstall(f.context), /Preserving a modified Hermes plugin file/);
    assert.match(fs.readFileSync(changed, "utf8"), /local customization/);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
  } finally {
    f.cleanup();
  }
});

test("Hermes rejects missing package assets and runtime before modifying the profile", () => {
  for (const missing of ["assets/hermes/plugin.yaml", "assets/hermes/__init__.py", "dist/cli.cjs"]) {
    const f = fixture();
    try {
      fs.unlinkSync(path.join(f.packageRoot, missing));
      assert.throws(() => hermesAdapter.install(f.context), /Missing (packaged asset|Cartograph runtime)/);
      assert.equal(fs.existsSync(f.targetRoot), false);
    } finally {
      f.cleanup();
    }
  }
});

test("Hermes doctor detects a removed bound runtime without claiming the host is enabled", () => {
  const f = fixture();
  try {
    hermesAdapter.install(f.context);
    fs.unlinkSync(path.join(f.packageRoot, "dist", "cli.cjs"));
    const report = hermesAdapter.doctor(f.context);
    assert.equal(report.installed, false);
    assert.ok(report.assets.every((asset) => asset.exists));
    assert.ok(report.issues?.some((issue) => /runtime cli/.test(issue)));
    assert.equal("enabled" in report, false);
  } finally {
    f.cleanup();
  }
});

test("Hermes installation and doctor reject an unusable cache path", () => {
  const f = fixture();
  try {
    hermesAdapter.install(f.context);
    const cache = path.join(f.targetRoot, "cache", "cartograph");
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, "existing user file");
    assert.throws(() => hermesAdapter.install(f.context), /cache path must be a directory/);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    assert.equal(fs.readFileSync(cache, "utf8"), "existing user file");
    hermesAdapter.uninstall(f.context);
    assert.equal(fs.readFileSync(cache, "utf8"), "existing user file");
  } finally {
    f.cleanup();
  }
});

test("Hermes refuses redirected plugin directories and leaves their targets untouched", (t) => {
  const f = fixture();
  const external = path.join(f.root, "external");
  try {
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "__init__.py"), "external plugin");
    fs.mkdirSync(path.dirname(f.pluginRoot), { recursive: true });
    try {
      fs.symlinkSync(external, f.pluginRoot, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Directory links are unavailable on this platform");
        return;
      }
      throw error;
    }
    assert.throws(() => hermesAdapter.install(f.context), /symlink or junction/);
    assert.throws(() => hermesAdapter.uninstall(f.context), /symlink or junction/);
    assert.equal(hermesAdapter.doctor(f.context).installed, false);
    assert.equal(fs.readFileSync(path.join(external, "__init__.py"), "utf8"), "external plugin");
    assert.deepEqual(fs.readdirSync(external), ["__init__.py"]);
  } finally {
    if (fs.lstatSync(f.pluginRoot, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(f.pluginRoot);
    f.cleanup();
  }
});
