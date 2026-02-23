import argparse
import json
import os
import subprocess
import sys
import threading
import uuid

from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse
import webbrowser


STATIC_DIR = Path(__file__).parent / "static"

DEFAULT_PROJECTS_ROOT = Path.home() / "GPT-Engineer-Projects"


@dataclass
class Job:
    id: str
    project_path: str
    prompt_file: str
    command: List[str]
    model: str | None = None
    mode: str = "generate"
    provider: str = "openai"
    status: str = "running"
    return_code: int | None = None
    output: List[str] = field(default_factory=list)
    process: subprocess.Popen | None = None
    io_lock: threading.Lock = field(default_factory=threading.Lock)


class JobRegistry:
    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(
        self,
        project_path: str,
        prompt_file: str,
        command: List[str],
        model: str | None,
        mode: str,
        provider: str,
    ) -> Job:
        job = Job(
            id=str(uuid.uuid4()),
            project_path=project_path,
            prompt_file=prompt_file,
            command=command,
            model=model,
            mode=mode,
            provider=provider,
        )
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)


JOB_REGISTRY = JobRegistry()


def _run_job(job: Job, env: Dict[str, str] | None = None) -> None:
    try:
        process = subprocess.Popen(
            job.command,
            cwd=job.project_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )
        job.process = process

        assert process.stdout is not None
        for line in process.stdout:
            with job.io_lock:
                job.output.append(line)

        process.wait()
        job.return_code = process.returncode
        job.status = "completed" if process.returncode == 0 else "failed"
    except Exception as exc:
        with job.io_lock:
            job.output.append(f"\n[web_local] Failed to run command: {exc}\n")
        job.return_code = -1
        job.status = "failed"
    finally:
        if job.process and job.process.stdin:
            try:
                job.process.stdin.close()
            except Exception:
                pass


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _text_response(handler: BaseHTTPRequestHandler, status: int, content_type: str, payload: bytes) -> None:
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _guess_content_type(file_path: Path) -> str:
    if file_path.suffix == ".html":
        return "text/html; charset=utf-8"
    if file_path.suffix == ".js":
        return "application/javascript; charset=utf-8"
    if file_path.suffix == ".css":
        return "text/css; charset=utf-8"
    return "application/octet-stream"


def _prepare_provider_env(
    provider: str,
    api_key: str | None,
    base_url: str | None,
) -> Dict[str, str]:
    env = os.environ.copy()

    if provider == "openai":
        if api_key:
            env["OPENAI_API_KEY"] = api_key
        return env

    if provider == "openrouter":
        if not api_key:
            raise ValueError("api_key is required for openrouter")
        env["OPENAI_API_KEY"] = api_key
        env["OPENAI_API_BASE"] = "https://openrouter.ai/api/v1"
        env["OPENAI_BASE_URL"] = "https://openrouter.ai/api/v1"
        env["LOCAL_MODEL"] = "true"
        return env

    if provider == "private_server":
        if not base_url:
            raise ValueError("base_url is required for private_server")
        env["OPENAI_API_KEY"] = api_key or "sk-private"
        env["OPENAI_API_BASE"] = base_url
        env["OPENAI_BASE_URL"] = base_url
        env["LOCAL_MODEL"] = "true"
        return env

    raise ValueError("provider must be one of: openai, openrouter, private_server")


def _build_cli_command(project_dir: Path, prompt_file: str) -> List[str]:
    cli_executable = os.getenv("GPTE_CLI_EXECUTABLE")
    if cli_executable:
        return [
            cli_executable,
            str(project_dir),
            "--prompt_file",
            prompt_file,
        ]

    return [
        sys.executable,
        "-m",
        "gpt_engineer.applications.cli.main",
        str(project_dir),
        "--prompt_file",
        prompt_file,
    ]


class WebLocalHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            return _json_response(self, 200, {"ok": True})

        if parsed.path == "/api/default-project":
            DEFAULT_PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)
            return _json_response(self, 200, {"project_path": str(DEFAULT_PROJECTS_ROOT)})

        job_route_parts = parsed.path.strip("/").split("/")
        if len(job_route_parts) == 3 and job_route_parts[0] == "api" and job_route_parts[1] == "jobs":
            job_id = job_route_parts[2]
            job = JOB_REGISTRY.get(job_id)
            if not job:
                return _json_response(self, 404, {"error": "Job not found"})
            with job.io_lock:
                output = "".join(job.output)
            return _json_response(
                self,
                200,
                {
                    "id": job.id,
                    "status": job.status,
                    "return_code": job.return_code,
                    "project_path": job.project_path,
                    "prompt_file": job.prompt_file,
                    "model": job.model,
                    "mode": job.mode,
                    "provider": job.provider,
                    "accepting_input": job.status == "running" and job.process is not None,
                    "output": output,
                },
            )

        requested = "index.html" if parsed.path in ["", "/"] else parsed.path.lstrip("/")
        file_path = (STATIC_DIR / requested).resolve()
        if STATIC_DIR.resolve() not in file_path.parents and file_path != STATIC_DIR.resolve():
            return _text_response(self, 403, "text/plain; charset=utf-8", b"Forbidden")

        if not file_path.exists() or not file_path.is_file():
            return _text_response(self, 404, "text/plain; charset=utf-8", b"Not Found")

        content = file_path.read_bytes()
        return _text_response(self, 200, _guess_content_type(file_path), content)

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            return _json_response(self, 400, {"error": "Body is required"})

        try:
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return _json_response(self, 400, {"error": "Invalid JSON payload"})

        if parsed.path == "/api/run":
            project_path = payload.get("project_path", "").strip()
            prompt = payload.get("prompt", "").strip()
            model = payload.get("model", "").strip() or None
            mode = payload.get("mode", "generate").strip().lower()
            provider = payload.get("provider", "openai").strip().lower()
            api_key = payload.get("api_key", "").strip() or None
            base_url = payload.get("base_url", "").strip() or None

            if not project_path:
                project_path = str(DEFAULT_PROJECTS_ROOT)
            if not prompt:
                return _json_response(self, 400, {"error": "prompt is required"})
            if mode not in ["generate", "improve"]:
                return _json_response(self, 400, {"error": "mode must be generate or improve"})
            if provider not in ["openai", "openrouter", "private_server"]:
                return _json_response(
                    self,
                    400,
                    {"error": "provider must be openai, openrouter, or private_server"},
                )

            project_dir = Path(project_path).expanduser().resolve() if project_path else DEFAULT_PROJECTS_ROOT
            project_dir.mkdir(parents=True, exist_ok=True)

            prompt_file = "prompt.web"
            (project_dir / prompt_file).write_text(prompt, encoding="utf-8")

            command = _build_cli_command(project_dir, prompt_file)
            if mode == "improve":
                command.extend(["--improve", "--skip-file-selection"])
            if model:
                command.extend(["--model", model])

            try:
                provider_env = _prepare_provider_env(provider, api_key, base_url)
            except ValueError as exc:
                return _json_response(self, 400, {"error": str(exc)})

            job = JOB_REGISTRY.create(
                str(project_dir),
                prompt_file,
                command,
                model,
                mode,
                provider,
            )
            threading.Thread(target=_run_job, args=(job, provider_env), daemon=True).start()
            return _json_response(self, 202, {"job_id": job.id})

        job_input_parts = parsed.path.strip("/").split("/")
        if (
            len(job_input_parts) == 4
            and job_input_parts[0] == "api"
            and job_input_parts[1] == "jobs"
            and job_input_parts[3] == "input"
        ):
            job_id = job_input_parts[2]
            user_input = payload.get("input", "")
            if user_input is None:
                return _json_response(self, 400, {"error": "input is required"})

            job = JOB_REGISTRY.get(job_id)
            if not job:
                return _json_response(self, 404, {"error": "Job not found"})
            if job.status != "running" or not job.process or not job.process.stdin:
                return _json_response(self, 400, {"error": "Job is not accepting input"})

            with job.io_lock:
                job.output.append(f"\n[web input] {user_input}\n")

            try:
                job.process.stdin.write(str(user_input) + "\n")
                job.process.stdin.flush()
            except Exception as exc:
                return _json_response(self, 500, {"error": f"Failed to send input: {exc}"})

            return _json_response(self, 200, {"ok": True})

        return _json_response(self, 404, {"error": "Not found"})


def run_server(host: str, port: int) -> None:
    server = ThreadingHTTPServer((host, port), WebLocalHandler)
    print(f"Web app running at http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run local browser UI for gpt-engineer")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Open the UI in the default browser")
    args = parser.parse_args()

    if args.open:
        webbrowser.open(f"http://{args.host}:{args.port}")

    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
