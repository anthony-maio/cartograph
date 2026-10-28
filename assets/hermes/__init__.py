"""Hermes tools backed by the locally installed Cartograph CLI."""

import json
import math
import os
from pathlib import Path
import subprocess
import threading
import time


_MAX_CAPTURE_BYTES = 8 * 1024 * 1024
_MAX_STDERR_BYTES = 64 * 1024
_READ_CHUNK_BYTES = 64 * 1024
_MAX_SOURCE_CHARS = 8000
_ENV_KEYS = {
    "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TMP", "TEMP",
    "TMPDIR", "HOME", "USERPROFILE", "LANG", "LC_ALL",
}


class PluginError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _integer(value, name, low, high):
    if type(value) is not int or not low <= value <= high:
        raise PluginError("invalid_arguments", f"{name} must be an integer from {low} to {high}.")
    return value


def _runtime():
    try:
        data = json.loads(Path(__file__).with_name("runtime.json").read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Expected an object")
        for key in ("node", "cli", "cache_dir"):
            if not isinstance(data.get(key), str) or not Path(data[key]).is_absolute():
                raise ValueError(f"Invalid {key}")
        if not Path(data["node"]).is_file() or not Path(data["cli"]).is_file():
            raise ValueError("Installed executable or CLI is missing")
        return data
    except (OSError, ValueError, TypeError) as exc:
        raise PluginError(
            "runtime_unavailable",
            "Cartograph runtime is unavailable. Run cartograph install hermes in the same "
            "OS environment as Hermes, then cartograph doctor hermes.",
        ) from exc


def _repo(value, allowed_roots):
    if not isinstance(value, str) or not value.strip() or len(value) > 4096:
        raise PluginError("invalid_arguments", "repo must be an absolute local directory path.")
    candidate = Path(value)
    if "://" in value or not candidate.is_absolute():
        raise PluginError("invalid_arguments", "repo must be an absolute local directory path; URLs are not supported.")
    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, ValueError, RuntimeError) as exc:
        raise PluginError("invalid_arguments", "Repository directory does not exist or cannot be resolved.") from exc
    if not resolved.is_dir():
        raise PluginError("invalid_arguments", "repo must identify a directory.")
    if allowed_roots is not None:
        if not isinstance(allowed_roots, list) or not allowed_roots:
            raise PluginError("invalid_configuration", "allowed_roots must be a nonempty list of absolute directories.")
        roots = []
        for root in allowed_roots:
            if not isinstance(root, str) or not Path(root).is_absolute():
                raise PluginError("invalid_configuration", "Every allowed_roots entry must be an absolute directory.")
            try:
                root_path = Path(root).resolve(strict=True)
            except (OSError, ValueError, RuntimeError) as exc:
                raise PluginError("invalid_configuration", "An allowed_roots directory cannot be resolved.") from exc
            if not root_path.is_dir():
                raise PluginError("invalid_configuration", "Every allowed_roots entry must be a directory.")
            roots.append(root_path)
        if not any(resolved == root or root in resolved.parents for root in roots):
            raise PluginError("repository_not_allowed", "Repository is outside the configured allowed_roots.")
    return resolved


def _capture_command(argv, repo, env, timeout):
    process = subprocess.Popen(
        argv, cwd=str(repo), env=env, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False,
    )
    output = bytearray()
    exceeded = []
    read_errors = []
    stop = threading.Event()

    def read_stream(stream, name, maximum, capture):
        total = 0
        try:
            while not stop.is_set():
                chunk = stream.read1(_READ_CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > maximum:
                    exceeded.append(name)
                    stop.set()
                    break
                if capture:
                    output.extend(chunk)
        except (OSError, ValueError):
            read_errors.append(name)
            stop.set()
        finally:
            stream.close()

    readers = [
        threading.Thread(target=read_stream, args=(process.stdout, "stdout", _MAX_CAPTURE_BYTES, True), daemon=True),
        threading.Thread(target=read_stream, args=(process.stderr, "stderr", _MAX_STDERR_BYTES, False), daemon=True),
    ]
    deadline = time.monotonic() + timeout
    timed_out = False
    try:
        for reader in readers:
            reader.start()
        while process.poll() is None and not stop.is_set():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                break
            stop.wait(min(remaining, 0.05))
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)
        for reader in readers:
            reader.join(timeout=1)

    if exceeded:
        raise PluginError("output_too_large", f"Cartograph {exceeded[0]} exceeds its capture limit. Analyze a smaller source directory.")
    if timed_out:
        raise subprocess.TimeoutExpired(argv, timeout)
    if read_errors or any(reader.is_alive() for reader in readers):
        raise PluginError("analysis_failed", "Cartograph output could not be read completely. Retry the analysis.")
    return process.returncode, bytes(output)


def _run(runtime, repo, command, top, task, timeout):
    argv = [runtime["node"], runtime["cli"], command, str(repo), "--static", "--json", "--top", str(top)]
    if task is not None:
        argv.extend(["--task", task])
    env = {key: value for key, value in os.environ.items() if key.upper() in _ENV_KEYS}
    env.update(CARTOGRAPH_CACHE_DIR=runtime["cache_dir"], NO_COLOR="1")
    try:
        returncode, output = _capture_command(argv, repo, env, timeout)
        if returncode:
            raise PluginError("analysis_failed", f"Cartograph exited with code {returncode}. Check cartograph doctor hermes and repository readability.")
        data = json.loads(output.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Expected an object")
        return data
    except subprocess.TimeoutExpired as exc:
        raise PluginError("analysis_timeout", f"Cartograph exceeded its {timeout}-second timeout. Analyze a smaller source directory or adjust timeout_seconds.") from exc
    except OSError as exc:
        raise PluginError("runtime_unavailable", "Cartograph could not start. Run cartograph doctor hermes in the Hermes environment.") from exc
    except (ValueError, UnicodeError) as exc:
        raise PluginError("invalid_output", "Cartograph returned invalid JSON. Reinstall the plugin from the matching Cartograph package.") from exc


def _summarize(data, command, top, limit):
    files = data.get("files")
    if not isinstance(files, list) or any(not isinstance(item, dict) for item in files):
        raise PluginError("invalid_output", "Cartograph output is missing its file list.")
    if command == "analyze":
        edges = data.get("edges", [])
        if not isinstance(edges, list):
            raise PluginError("invalid_output", "Cartograph output has an invalid dependency list.")
        hubs = {}
        for edge in edges:
            if isinstance(edge, dict) and isinstance(edge.get("to"), str):
                hubs[edge["to"]] = hubs.get(edge["to"], 0) + 1
        result = {
            "total_files": len(files), "total_dependency_edges": len(edges),
            "files": [
                {key: item.get(key) for key in ("path", "language", "lines", "importanceScore")}
                for item in files[:top]
            ],
            "dependency_hubs": [
                {"path": name, "incoming_imports": count}
                for name, count in sorted(hubs.items(), key=lambda pair: (-pair[1], pair[0]))[:top]
            ],
        }
    else:
        selected = []
        remaining = max(0, limit - 3000)
        for item in files[:top]:
            content = item.get("content")
            if not isinstance(content, str) or not isinstance(item.get("path"), str):
                raise PluginError("invalid_output", "Cartograph context is missing a file path or source content.")
            excerpt = content[:min(_MAX_SOURCE_CHARS, remaining)]
            if not excerpt:
                break
            remaining -= len(excerpt)
            selected_file = {"path": item["path"], "reason": str(item.get("reason", ""))[:500], "content": excerpt, "truncated": bool(item.get("truncated")) or len(excerpt) < len(content)}
            if type(item.get("startLine")) is int and item["startLine"] >= 1:
                selected_file["startLine"] = item["startLine"]
                if excerpt == content and type(item.get("endLine")) is int and item["endLine"] >= item["startLine"]:
                    selected_file["endLine"] = item["endLine"]
                else:
                    # Source positions use newline characters, not Python's
                    # wider splitlines() set of Unicode separators.
                    line_count = excerpt.count("\n") + (0 if excerpt.endswith("\n") else 1)
                    selected_file["endLine"] = item["startLine"] + max(1, line_count) - 1
            selected.append(selected_file)
        result = {
            "files": selected,
            "totalTokens": sum(math.ceil(len(item["content"]) / 4) for item in selected),
            "truncated": len(selected) < len(files) or any(item["truncated"] for item in selected),
            "selection": "Static lexical matching, dependencies, and related tests. Verify the selected source before editing.",
        }
        if not files:
            result["message"] = "No task-matched source files. Try concrete module, symbol, or filename terms."
    # Account for JSON escaping and metadata as well as raw source characters.
    while len(json.dumps(result, ensure_ascii=False)) > limit:
        if result["files"]:
            result["files"].pop()
            result["truncated"] = True
        elif result.get("dependency_hubs"):
            result["dependency_hubs"].pop()
            result["truncated"] = True
        else:
            raise PluginError("output_too_large", "Result metadata exceeds max_output_chars.")
    if command == "context":
        result["totalTokens"] = sum(math.ceil(len(item["content"]) / 4) for item in result["files"])
    return result


def _handle(ctx, command, args):
    try:
        permitted = {"repo", "top"} | ({"task"} if command == "context" else set())
        if not isinstance(args, dict) or set(args) - permitted:
            raise PluginError("invalid_arguments", "Unexpected tool arguments.")
        top = _integer(args.get("top", 6), "top", 1, 20)
        task = args.get("task") if command == "context" else None
        if command == "context" and (not isinstance(task, str) or not task.strip() or len(task) > 2000):
            raise PluginError("invalid_arguments", "task must contain 1 to 2000 characters.")
        repo = _repo(args.get("repo"), ctx.get_config("allowed_roots", None))
        timeout = _integer(ctx.get_config("timeout_seconds", 120), "timeout_seconds", 5, 300)
        limit = _integer(ctx.get_config("max_output_chars", 40000), "max_output_chars", 4000, 100000)
        data = _run(_runtime(), repo, command, top, task, timeout)
        return json.dumps(_summarize(data, command, top, limit), ensure_ascii=False)
    except PluginError as exc:
        return json.dumps({"error": str(exc), "code": exc.code})


def register(ctx):
    common = {
        "repo": {"type": "string", "description": "Absolute local repository or source directory path in the Hermes OS environment.", "maxLength": 4096},
        "top": {"type": "integer", "description": "Maximum files to return (default 6).", "minimum": 1, "maximum": 20},
    }
    for name, command, description in (
        ("cartograph_analyze", "analyze", "Map a local code repository: ranked files and dependency hubs. Static analysis only; no model API. Use before selecting task context."),
        ("cartograph_context", "context", "Select source excerpts, dependencies, and related tests for a concrete coding task. Static lexical matching only; use module or symbol names, inspect truncation, and verify source before editing."),
    ):
        properties = dict(common)
        required = ["repo"]
        if command == "context":
            properties["task"] = {"type": "string", "minLength": 1, "maxLength": 2000}
            required.append("task")

        def handler(args, _command=command, **kwargs):
            return _handle(ctx, _command, args)

        ctx.register_tool(
            name=name, toolset="cartograph",
            schema={"name": name, "description": description, "parameters": {"type": "object", "properties": properties, "required": required, "additionalProperties": False}},
            handler=handler,
        )
