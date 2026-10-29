"""Host-independent contracts; scripts/hermes-smoke.py checks the real host."""

import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[2] / "assets" / "hermes" / "__init__.py"
spec = importlib.util.spec_from_file_location("cartograph_plugin_test", SOURCE)
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class Context:
    def __init__(self, **settings):
        self.settings = settings
        self.tools = {}

    def get_config(self, key, default=None):
        return self.settings.get(key, default)

    def register_tool(self, **kwargs):
        self.tools[kwargs["name"]] = kwargs


class CompletedChild:
    def __init__(self, stdout=b'{"files": []}', stderr=b"", returncode=0):
        self.stdout = io.BytesIO(stdout)
        self.stderr = io.BytesIO(stderr)
        self.returncode = returncode

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        return self.returncode

    def kill(self):
        raise AssertionError("A completed child must not be killed")


class PluginTests(unittest.TestCase):
    def test_catalog_runtime_uses_settings_and_profile_cache_without_runtime_file(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder).resolve()
            cli = home / "cli.cjs"
            cli.write_text("// fixture", encoding="utf-8")
            location = home / "plugins" / "cartograph" / "__init__.py"
            ctx = Context(node_path=sys.executable, cli_path=str(cli))
            ctx.state = SimpleNamespace(data_dir=home / "plugin-data" / "cartograph")
            with patch.object(plugin, "__file__", str(location)):
                self.assertEqual(plugin._configured_runtime(ctx), {
                    "node": sys.executable, "cli": str(cli),
                    "cache_dir": str(home / "plugin-data" / "cartograph" / "cache"),
                })

    def test_catalog_runtime_rejects_partial_relative_and_missing_configuration(self):
        for settings in ({"node_path": sys.executable}, {"node_path": "node", "cli_path": "cli.cjs"},
                         {"node_path": sys.executable, "cli_path": str(Path.cwd() / "missing-cli.cjs")}):
            with self.subTest(settings=settings), self.assertRaises(plugin.PluginError):
                plugin._configured_runtime(Context(**settings))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / "repo with spaces"
        self.repo.mkdir()
        self.ctx = Context(allowed_roots=[str(self.repo)])
        plugin.register(self.ctx)

    def call(self, name="cartograph_context", **args):
        raw = self.ctx.tools[name]["handler"](args, task_id="test", session_id="test")
        self.assertIsInstance(raw, str)
        return json.loads(raw)

    def test_rejects_nonlocal_missing_relative_and_disallowed_repositories_without_launch(self):
        outside = self.root / "outside"
        outside.mkdir()
        for repo in ("https://example.com/repo", "../repo", str(self.repo / "missing"), str(outside)):
            with self.subTest(repo=repo), patch.object(plugin, "_run") as run:
                result = self.call(repo=repo, task="refresh token")
                self.assertIn("error", result)
                run.assert_not_called()

    def test_resolved_root_boundary_rejects_escape_symlink(self):
        outside = self.root / "outside"
        outside.mkdir()
        link = self.repo / "escape"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError as exc:
            if getattr(exc, "winerror", None) == 1314:
                self.skipTest("Windows account lacks symlink privilege")
            raise
        with patch.object(plugin, "_run") as run:
            result = self.call(repo=str(link), task="refresh token")
            self.assertEqual(result["code"], "repository_not_allowed")
            run.assert_not_called()

    def test_empty_allowlist_fails_closed(self):
        self.ctx.settings["allowed_roots"] = []
        result = self.call(repo=str(self.repo), task="refresh token")
        self.assertEqual(result["code"], "invalid_configuration")

    def test_rejects_argument_overrides_and_invalid_budgets(self):
        for changes in ({"command": "shell"}, {"top": True}, {"top": 0}, {"top": 21}, {"task": ""}, {"task": "x" * 2001}):
            args = {"repo": str(self.repo), "task": "refresh token", **changes}
            with self.subTest(changes=changes), patch.object(plugin, "_run") as run:
                self.assertEqual(self.call(**args)["code"], "invalid_arguments")
                run.assert_not_called()

    def test_missing_install_returns_actionable_error(self):
        with patch.object(plugin, "__file__", str(self.root / "plugin" / "__init__.py")):
            result = self.call(repo=str(self.repo), task="refresh token")
            self.assertEqual(result["code"], "runtime_unavailable")
            self.assertIn("cartograph install hermes", result["error"])

    def test_static_invocation_preserves_task_as_one_argument_and_drops_credentials(self):
        runtime = {"node": "/node", "cli": "/cli.cjs", "cache_dir": str(self.root / "cache")}
        task = 'refresh token; $(echo secret) "quoted"'

        def child(argv, **kwargs):
            self.assertEqual(argv[-2:], ["--task", task])
            self.assertIn("--static", argv)
            self.assertFalse(kwargs["shell"])
            self.assertEqual(kwargs["cwd"], str(self.repo))
            self.assertEqual(kwargs["env"]["CARTOGRAPH_CACHE_DIR"], runtime["cache_dir"])
            self.assertNotIn("OPENAI_API_KEY", kwargs["env"])
            self.assertNotIn("CARTOGRAPH_API_KEY", kwargs["env"])
            self.assertNotIn("NODE_OPTIONS", kwargs["env"])
            self.assertEqual(kwargs["stdout"], subprocess.PIPE)
            self.assertEqual(kwargs["stderr"], subprocess.PIPE)
            return CompletedChild()

        with patch.dict(os.environ, {"OPENAI_API_KEY": "private", "CARTOGRAPH_API_KEY": "private", "NODE_OPTIONS": "--require bad.js"}), patch.object(plugin.subprocess, "Popen", side_effect=child):
            self.assertEqual(plugin._run(runtime, self.repo, "context", 6, task, 10), {"files": []})

    def test_process_failures_are_bounded_structured_errors(self):
        runtime = {"node": "/node", "cli": "/cli.cjs", "cache_dir": str(self.root / "cache")}
        for failure, code in ((subprocess.TimeoutExpired("node", 5), "analysis_timeout"), (OSError("private detail"), "runtime_unavailable")):
            with self.subTest(code=code), patch.object(plugin, "_runtime", return_value=runtime), patch.object(plugin.subprocess, "Popen", side_effect=failure):
                result = self.call(repo=str(self.repo), task="refresh token")
                self.assertEqual(result["code"], code)
                self.assertNotIn("private detail", json.dumps(result))

    def test_failed_process_does_not_echo_stderr(self):
        def child(argv, **kwargs):
            return CompletedChild(stderr=b"PRIVATE_SOURCE_CANARY", returncode=7)

        with patch.object(plugin, "_runtime", return_value={"node": "/node", "cli": "/cli", "cache_dir": "/cache"}), patch.object(plugin.subprocess, "Popen", side_effect=child):
            result = self.call(repo=str(self.repo), task="refresh token")
            self.assertEqual(result["code"], "analysis_failed")
            self.assertNotIn("PRIVATE_SOURCE_CANARY", json.dumps(result))

    def test_capture_accepts_exact_stream_boundaries_and_rejects_the_next_byte(self):
        runtime = {"node": "/node", "cli": "/cli", "cache_dir": "/cache"}
        maximum = 1024
        stdout = b'{"files": []}' + b" " * (maximum - len(b'{"files": []}'))
        with patch.object(plugin, "_MAX_CAPTURE_BYTES", maximum), patch.object(plugin, "_MAX_STDERR_BYTES", maximum):
            with patch.object(plugin.subprocess, "Popen", return_value=CompletedChild(stdout, b"x" * maximum)):
                self.assertEqual(plugin._run(runtime, self.repo, "context", 6, "refresh", 10), {"files": []})
            for captured, errors in ((stdout + b" ", b""), (b'{"files": []}', b"x" * (maximum + 1))):
                with self.subTest(stderr=bool(errors)), patch.object(plugin.subprocess, "Popen", return_value=CompletedChild(captured, errors)):
                    with self.assertRaises(plugin.PluginError) as raised:
                        plugin._run(runtime, self.repo, "context", 6, "refresh", 10)
                    self.assertEqual(raised.exception.code, "output_too_large")

    def test_oversized_real_child_stream_is_killed_before_its_sleep_finishes(self):
        real_popen = subprocess.Popen
        for stream in ("stdout", "stderr"):
            with self.subTest(stream=stream):
                script = self.root / f"oversized-{stream}.py"
                script.write_text(
                    "import sys, time\n"
                    f"sys.{stream}.buffer.write(b'x' * 1025)\n"
                    f"sys.{stream}.buffer.flush()\n"
                    "time.sleep(15)\n",
                    encoding="utf-8",
                )
                runtime = {"node": sys.executable, "cli": str(script), "cache_dir": str(self.root / "cache")}
                children = []

                def start(argv, **kwargs):
                    process = real_popen(argv, **kwargs)
                    children.append(process)
                    return process

                started = time.monotonic()
                with patch.object(plugin, "_MAX_CAPTURE_BYTES", 1024), patch.object(plugin, "_MAX_STDERR_BYTES", 1024), patch.object(plugin.subprocess, "Popen", side_effect=start):
                    with self.assertRaises(plugin.PluginError) as raised:
                        plugin._run(runtime, self.repo, "context", 6, "refresh", 10)
                self.assertEqual(raised.exception.code, "output_too_large")
                self.assertLess(time.monotonic() - started, 5)
                self.assertEqual(len(children), 1)
                self.assertIsNotNone(children[0].poll(), "Overflow must reap the child, not leave its sleep running")
                self.assertTrue(children[0].stdout.closed)
                self.assertTrue(children[0].stderr.closed)

    def test_real_child_timeout_kills_and_reaps_the_process(self):
        script = self.root / "sleep.py"
        script.write_text("import time\ntime.sleep(15)\n", encoding="utf-8")
        runtime = {"node": sys.executable, "cli": str(script), "cache_dir": str(self.root / "cache")}
        real_popen = subprocess.Popen
        children = []

        def start(argv, **kwargs):
            process = real_popen(argv, **kwargs)
            children.append(process)
            return process

        started = time.monotonic()
        with patch.object(plugin.subprocess, "Popen", side_effect=start):
            with self.assertRaises(plugin.PluginError) as raised:
                plugin._run(runtime, self.repo, "context", 6, "refresh", 0.2)
        self.assertEqual(raised.exception.code, "analysis_timeout")
        self.assertLess(time.monotonic() - started, 3)
        self.assertIsNotNone(children[0].poll())
        self.assertTrue(children[0].stdout.closed)
        self.assertTrue(children[0].stderr.closed)

    def test_invalid_child_json_returns_structured_error(self):
        for output in (b"not json", b"[]", b"\xff"):
            with self.subTest(output=output), patch.object(plugin, "_runtime", return_value={"node": "/node", "cli": "/cli", "cache_dir": "/cache"}), patch.object(plugin.subprocess, "Popen", return_value=CompletedChild(stdout=output)):
                self.assertEqual(self.call(repo=str(self.repo), task="refresh")["code"], "invalid_output")

    def test_context_is_bounded_and_marks_truncation(self):
        data = {"files": [{"path": f"src/file{i}.py", "reason": "Relevant", "content": '"\\\n' * 6000} for i in range(6)]}
        result = plugin._summarize(data, "context", 6, 4000)
        self.assertLessEqual(len(json.dumps(result, ensure_ascii=False)), 4000)
        self.assertTrue(result["truncated"])
        self.assertEqual(result["totalTokens"], sum((len(item["content"]) + 3) // 4 for item in result["files"]))

    def test_no_matches_are_reported_without_padding(self):
        result = plugin._summarize({"files": []}, "context", 6, 40000)
        self.assertEqual(result["files"], [])
        self.assertIn("No task-matched", result["message"])

    def test_context_preserves_source_locations_and_upstream_truncation(self):
        data = {"files": [{"path": "src/cli.ts", "reason": "Provider validation", "content": "first\nsecond\n", "startLine": 360, "endLine": 361, "truncated": True}]}
        result = plugin._summarize(data, "context", 6, 40000)
        self.assertEqual(result["files"][0]["startLine"], 360)
        self.assertEqual(result["files"][0]["endLine"], 361)
        self.assertTrue(result["files"][0]["truncated"])
        self.assertTrue(result["truncated"])

    def test_context_line_ranges_follow_source_newlines_not_unicode_separators(self):
        content = 'const first = "a\u2028b\u0085c";\nconst second = 2;\n'
        data = {"files": [{"path": "src/a.js", "reason": "test", "content": content, "startLine": 40, "endLine": 41, "truncated": False}]}
        result = plugin._summarize(data, "context", 6, 40000)
        self.assertEqual(result["files"][0]["endLine"], 41)
        with patch.object(plugin, "_MAX_SOURCE_CHARS", content.index("\n") + 1):
            shortened = plugin._summarize(data, "context", 6, 40000)
        self.assertEqual(shortened["files"][0]["endLine"], 40)
        self.assertTrue(shortened["files"][0]["truncated"])

    def test_analysis_returns_compact_metadata_without_source(self):
        data = {"files": [{"path": "src/a.py", "language": "python", "lines": 1, "importanceScore": 30}], "edges": [{"from": "src/b.py", "to": "src/a.py"}], "fileContents": {"src/a.py": "PRIVATE_SOURCE"}}
        result = plugin._summarize(data, "analyze", 6, 40000)
        self.assertEqual(result["total_files"], 1)
        self.assertEqual(result["dependency_hubs"], [{"path": "src/a.py", "incoming_imports": 1}])
        self.assertNotIn("PRIVATE_SOURCE", json.dumps(result))

    def test_tool_registration_keeps_analysis_and_context_distinct(self):
        with patch.object(plugin, "_handle", return_value='{"ok": true}') as handle:
            self.call("cartograph_analyze", repo=str(self.repo))
            self.assertEqual(handle.call_args.args[1], "analyze")
            self.call(repo=str(self.repo), task="refresh token")
            self.assertEqual(handle.call_args.args[1], "context")
        self.assertEqual(set(self.ctx.tools), {"cartograph_analyze", "cartograph_context"})


if __name__ == "__main__":
    unittest.main()
