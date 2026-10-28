#!/usr/bin/env python3
"""Exercise Cartograph through an installed Hermes loader and tool dispatcher.

Run this in the same operating system as Hermes and the Cartograph Node runtime.
The check creates a disposable profile; it does not edit the user's Hermes home.
It invokes native tools directly and does not test autonomous model tool choice.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time


TASK = "Validate unknown LLM providers and require API keys in the CLI"
TOOLS = {"cartograph_analyze", "cartograph_context"}


def require(condition: object, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def run(command: list[str], *, env: dict[str, str], cwd: Path, timeout: int = 120) -> str:
    completed = subprocess.run(
        command, cwd=cwd, env=env, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=timeout, check=False,
    )
    if completed.returncode:
        raise RuntimeError(
            f"Command exited {completed.returncode}: {command[0]}\n"
            f"{completed.stdout[-8000:]}\n{completed.stderr[-8000:]}"
        )
    return completed.stdout


def git_head(path: Path) -> str:
    return subprocess.check_output(
        ["git", "-C", str(path), "rev-parse", "HEAD"], text=True,
        encoding="utf-8", stderr=subprocess.PIPE,
    ).strip()


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hermes", default="hermes", help="Installed Hermes launcher")
    parser.add_argument("--hermes-source", required=True, type=Path)
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--cli", required=True, type=Path, help="Installed Cartograph dist/cli.cjs")
    parser.add_argument("--plugin", type=Path, default=root / "assets" / "hermes")
    parser.add_argument("--profile-parent", type=Path,
                        help="Existing Hermes profiles directory; reuse its dependency runtime in a new temporary profile")
    parser.add_argument("--repo", type=Path, default=root)
    parser.add_argument("--task", default=TASK)
    parser.add_argument("--top", type=int, default=6)
    parser.add_argument("--expected-file", default="src/cli.ts")
    parser.add_argument("--expected-text", action="append", default=None)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--_child", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--_home", type=Path, help=argparse.SUPPRESS)
    return parser.parse_args()


def child_check(args: argparse.Namespace) -> dict:
    # These imports deliberately resolve from the real installed Hermes source,
    # after its managed-runtime bootstrap, rather than from a simulated context.
    from hermes_cli.plugins import discover_plugins, get_plugin_manager
    from tools.registry import registry

    discover_plugins()
    manager = get_plugin_manager()
    plugins = manager.list_plugins()
    cartograph = next((p for p in plugins if p["name"] == "cartograph"), None)
    require(cartograph is not None, "Hermes did not discover the Cartograph plugin")
    require(cartograph["enabled"] and not cartograph["error"], str(cartograph))
    require(cartograph["source"] == "user", "Expected isolated directory-plugin discovery")
    require(not any(
        p["enabled"] and p["source"] in {"user", "entrypoint", "project"}
        and p["name"] != "cartograph" for p in plugins
    ), "An unrelated external plugin was enabled in the isolated profile")

    from model_tools import get_tool_definitions, handle_function_call

    definitions = get_tool_definitions(
        enabled_toolsets=["cartograph"], quiet_mode=True, skip_tool_search_assembly=True,
    )
    exposed = {item["function"]["name"] for item in definitions}
    require(TOOLS <= exposed, f"Tools absent from Hermes model definitions: {TOOLS - exposed}")

    def dispatch(name: str, arguments: dict) -> dict:
        raw = handle_function_call(
            name, arguments, task_id="cartograph-smoke", session_id="cartograph-smoke",
            enabled_toolsets=["cartograph"], enabled_tools=sorted(TOOLS),
        )
        require(isinstance(raw, str), "Hermes tool result must be a JSON string")
        result = json.loads(raw)
        require(isinstance(result, dict), "Expected a structured Cartograph result")
        return result

    repo = args.repo.resolve()
    analysis = dispatch("cartograph_analyze", {"repo": str(repo), "top": args.top})
    require(not analysis.get("error"), f"Analyze failed: {analysis}")
    packet = dispatch("cartograph_context", {
        "repo": str(repo), "task": args.task, "top": args.top,
    })
    require(not packet.get("error"), f"Context failed: {packet}")
    args.output.with_suffix(".context.json").write_text(json.dumps(packet, indent=2) + "\n", encoding="utf-8")
    files = packet.get("files", [])
    require(isinstance(files, list) and files, "Context returned no source files")
    checked = []
    for item in files:
        relative = item["path"]
        source = (repo / relative).resolve()
        require(source.is_relative_to(repo), f"Context escaped the target repository: {relative}")
        require(source.is_file(), f"Context named a nonexistent file: {relative}")
        content = item.get("content", "")
        require(isinstance(content, str) and content.strip(), f"Empty source context: {relative}")
        source_text = source.read_bytes().decode("utf-8")
        # The older CLI appends this exact display marker after a source prefix.
        # Remove only that marker before comparing source bytes; keep it in the
        # receipt and preserve the useful-source assertions below.
        excerpt = re.sub(r"\n// \.\.\. \(\d+ more lines truncated\)$", "", content)
        require(excerpt in source_text, f"Context differs from actual source: {relative}")
        start, end = item.get("startLine"), item.get("endLine")
        require(type(start) is int and type(end) is int and 1 <= start <= end,
                f"Missing or invalid source line range: {relative}")
        source_lines = source_text.split("\n")
        require(end <= len(source_lines), f"Line range exceeds source file: {relative}")
        selected_lines = "\n".join(source_lines[start - 1:end])
        # Splitting CRLF source at LF leaves a terminal CR on the last line;
        # it is part of that line's delimiter, not a source character.
        require(content == selected_lines or content == selected_lines.removesuffix("\r"),
                f"Context does not match its declared line range: {relative}")
        checked.append({"path": relative, "characters": len(content),
                        "sha256": hashlib.sha256(content.encode()).hexdigest(),
                        "start_line": start, "end_line": end,
                        "truncated": bool(item.get("truncated"))})
    expected = next((item for item in files if item["path"] == args.expected_file), None)
    require(expected is not None, f"Relevant file missing: {args.expected_file}")
    expected_text = args.expected_text or ["Unknown provider", "API key required"]
    for text in expected_text:
        require(text in expected["content"],
                f"Relevant source omitted from {args.expected_file}: {text!r}")
    require(isinstance(packet.get("totalTokens"), (int, float)), "Missing context token count")

    invalid = dispatch("cartograph_context", {
        "repo": str(args._home / "does-not-exist"), "task": args.task,
    })
    require(bool(invalid.get("error")), "Invalid repository did not return an error")
    cache = args._home / "cache" / "cartograph"
    cache_files = sorted(path for path in cache.rglob("*") if path.is_file())
    require(bool(cache_files), "Cartograph did not persist results in its isolated profile cache")
    manager.unload("cartograph")
    require(all(registry.get_entry(name) is None for name in TOOLS),
            "Hermes retained Cartograph tools after plugin unload")
    return {
        "status": "passed",
        "checks": {"native_discovery": True, "model_tool_exposure": True,
                   "native_analyze_dispatch": True, "native_context_dispatch": True,
                   "snippets_match_real_source": True, "task_logic_in_context": True,
                   "source_line_ranges": True,
                   "invalid_repository_error": True, "profile_cache": True,
                   "unload_removes_tools": True, "no_unrelated_external_plugins": True},
        "repository": {"head": git_head(repo), "task": args.task,
                       "working_tree_dirty": bool(subprocess.check_output(
                           ["git", "-C", str(repo), "status", "--porcelain"], text=True,
                           encoding="utf-8", stderr=subprocess.PIPE,
                       ).strip()),
                       "expected_file": args.expected_file, "expected_text": expected_text},
        "context": {"files": checked, "total_tokens": packet["totalTokens"],
                    "truncated": packet.get("truncated")},
        "cache_files": [str(path.relative_to(cache)) for path in cache_files],
        "hermes": {"commit": git_head(args.hermes_source), "python": sys.version.split()[0]},
        "limits": "Native Hermes loader and tool dispatch; no model-driven tool-selection claim.",
    }


def parent_check(args: argparse.Namespace) -> dict:
    for key in ("hermes_source", "cli", "plugin", "repo", "output"):
        setattr(args, key, getattr(args, key).resolve())
    node = shutil.which(args.node)
    require(node, f"Node executable not found: {args.node}")
    require(args.cli.is_file(), f"Cartograph CLI not found: {args.cli}")
    require(args.plugin.is_dir(), f"Plugin directory not found: {args.plugin}")
    require((args.repo / ".git").exists(), "Acceptance target must be a real Git repository")
    if args.profile_parent is not None:
        args.profile_parent = args.profile_parent.resolve(strict=True)
        require(args.profile_parent.is_dir(), "Profile parent must be an existing directory")
    with tempfile.TemporaryDirectory(prefix="cartograph-hermes-smoke-", dir=args.profile_parent) as temporary:
        home = Path(temporary).resolve()
        destination = home / "plugins" / "cartograph"
        cache = home / "cache" / "cartograph"
        (home / "config.yaml").write_text(
            "plugins:\n  enabled: [cartograph]\n  disabled: []\n  isolation: in_process\n"
            "security:\n  allow_lazy_installs: false\n", encoding="utf-8",
        )
        permitted = {"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TMP", "TEMP",
                     "TMPDIR", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "LC_CTYPE",
                     "APPDATA", "LOCALAPPDATA", "PROGRAMDATA"}
        env = {key: value for key, value in os.environ.items() if key.upper() in permitted}
        env.update(HERMES_HOME=str(home), HERMES_ENABLE_PROJECT_PLUGINS="0",
                   HERMES_DISABLE_LAZY_INSTALLS="1", PYTHONDONTWRITEBYTECODE="1", NO_COLOR="1")
        config_before = (home / "config.yaml").read_bytes()
        cli_hash = hashlib.sha256(args.cli.read_bytes()).hexdigest()
        install_log = run([node, str(args.cli), "install", "hermes"], env=env, cwd=home)
        require((home / "config.yaml").read_bytes() == config_before,
                "Cartograph installer modified Hermes configuration")
        for filename in ("plugin.yaml", "__init__.py"):
            require((destination / filename).read_bytes() == (args.plugin / filename).read_bytes(),
                    f"Installed plugin differs from provided packaged asset: {filename}")
        installed_runtime = json.loads((destination / "runtime.json").read_text(encoding="utf-8"))
        require(Path(installed_runtime["node"]).resolve() == Path(node).resolve(),
                "Installer recorded a different Node runtime")
        require(Path(installed_runtime["cli"]).resolve() == args.cli,
                "Installer recorded a different Cartograph CLI")
        require(Path(installed_runtime["cache_dir"]).resolve() == cache,
                "Installer cache escaped the isolated Hermes profile")
        cartograph_doctor = json.loads(run(
            [node, str(args.cli), "doctor", "hermes", "--json"], env=env, cwd=home,
        ))
        adapter = next(item for item in cartograph_doctor["adapters"] if item["id"] == "hermes")
        require(adapter["installed"] and not adapter.get("issues"),
                "Cartograph doctor did not confirm a healthy Hermes installation")
        runtime = json.loads(run(
            [args.hermes, "--print-runtime-command"], env=env, cwd=home,
        ))
        require(runtime[1:3] == ["-I", "-c"], "Unrecognized Hermes managed-runtime command")
        constants = {node.value for node in ast.walk(ast.parse(runtime[3]))
                     if isinstance(node, ast.Constant) and isinstance(node.value, str)}
        require(str(args.hermes_source) in constants,
                "The provided Hermes source does not match the installed launcher")
        doctor = run([args.hermes, "plugins", "doctor", str(destination), "--ci"],
                     env=env, cwd=home)
        # Use the launcher's interpreter and the same source bootstrap. The child
        # executes this harness instead of the interactive CLI entry point.
        bootstrap = (
            "import os,sys,runpy; "
            "os.environ.pop('PYTHONHOME',None); os.environ.pop('PYTHONPATH',None); "
            "os.environ.pop('VIRTUAL_ENV',None); sys.path.insert(0,sys.argv.pop(1)); "
            "import hermes_bootstrap; runpy.run_path(sys.argv.pop(1),run_name='__main__')"
        )
        child_args = ["--_child", "--_home", str(home), "--hermes-source", str(args.hermes_source),
                      "--cli", str(args.cli), "--repo", str(args.repo), "--task", args.task,
                      "--top", str(args.top), "--expected-file", args.expected_file,
                      "--output", str(args.output)]
        for expected in args.expected_text or []:
            child_args.extend(["--expected-text", expected])
        run([runtime[0], "-I", "-c", bootstrap, str(args.hermes_source),
             str(Path(__file__).resolve()), *child_args], env=env, cwd=home, timeout=180)
        receipt = json.loads(args.output.read_text(encoding="utf-8"))
        receipt["checks"].update(plugin_doctor=True, cli_installer=True,
                                 installed_assets_match=True, runtime_paths=True,
                                 installer_preserves_config=True, cartograph_doctor=True)
        receipt["doctor"] = doctor.strip()
        receipt["install_log"] = install_log.strip()
        receipt["node_version"] = run([node, "--version"], env=env, cwd=home).strip()
        require(hashlib.sha256(args.cli.read_bytes()).hexdigest() == cli_hash,
                "Cartograph CLI changed during acceptance testing")
        receipt["cli_sha256"] = cli_hash
        receipt["plugin_sha256"] = hashlib.sha256((destination / "__init__.py").read_bytes()).hexdigest()
        return receipt


def main() -> int:
    args = parse_args()
    started = time.monotonic()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        receipt = child_check(args) if args._child else parent_check(args)
    except Exception as error:
        receipt = {"status": "failed", "error": str(error), "type": type(error).__name__}
    receipt["duration_seconds"] = round(time.monotonic() - started, 3)
    args.output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": receipt["status"], "receipt": str(args.output),
                      **({"error": receipt["error"]} if "error" in receipt else {})}))
    return 0 if receipt["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
