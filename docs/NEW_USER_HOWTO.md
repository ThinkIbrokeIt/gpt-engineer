# GPT Engineer: Detailed How-To for New Users

This guide is for first-time users who want to run GPT Engineer locally with minimal friction.

It covers:

- Prerequisites
- Installation (stable and development)
- API/provider setup (OpenAI, OpenRouter, private server)
- Running with CLI, local Web UI, and Electron
- A full first-project walkthrough
- Common troubleshooting

---

## 1) Prerequisites

### Required

- Python **3.10, 3.11, or 3.12**
- Git
- Internet access for hosted LLM providers (OpenAI/OpenRouter)

### Optional (for Electron desktop app)

- Node.js 18+
- npm

### Verify your versions

#### macOS / Linux

```bash
python --version
git --version
node --version
npm --version
```

#### Windows (PowerShell)

```powershell
python --version
git --version
node --version
npm --version
```

If your Python version is 3.14 (or outside 3.10–3.12), install a supported version first.

---

## 2) Choose installation mode

## Option A: Stable install (quickest)

```bash
python -m pip install gpt-engineer
```

Then run CLI commands with:

```bash
gpte --help
```

## Option B: Development install (recommended if you cloned this repo)

```bash
git clone https://github.com/gpt-engineer-org/gpt-engineer.git
cd gpt-engineer
poetry install
poetry shell
```

If you are inside this repository and want the newest local code, use this option.

---

## 3) Configure your LLM provider

GPT Engineer supports different providers. Pick one.

## A) OpenAI

Set your API key:

### macOS / Linux

```bash
export OPENAI_API_KEY="your-openai-key"
```

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="your-openai-key"
```

## B) OpenRouter

Set these values:

### macOS / Linux

```bash
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_API_BASE="https://openrouter.ai/api/v1"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export LOCAL_MODEL=true
```

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="your-openrouter-key"
$env:OPENAI_API_BASE="https://openrouter.ai/api/v1"
$env:OPENAI_BASE_URL="https://openrouter.ai/api/v1"
$env:LOCAL_MODEL="true"
```

Model examples:

- `meta-llama/llama-3-8b-instruct:extended`
- `openai/gpt-4o-mini`

## C) Private OpenAI-compatible server

For local/self-hosted endpoints (for example `http://localhost:8000/v1`):

### macOS / Linux

```bash
export OPENAI_API_BASE="http://localhost:8000/v1"
export OPENAI_BASE_URL="http://localhost:8000/v1"
export OPENAI_API_KEY="sk-private"
export LOCAL_MODEL=true
```

### Windows PowerShell

```powershell
$env:OPENAI_API_BASE="http://localhost:8000/v1"
$env:OPENAI_BASE_URL="http://localhost:8000/v1"
$env:OPENAI_API_KEY="sk-private"
$env:LOCAL_MODEL="true"
```

---

## 4) Run GPT Engineer (three ways)

## A) CLI mode

1. Create a project folder (anywhere):

```bash
mkdir my-new-project
```

2. Create a `prompt` file in that folder with your instructions.

3. Run generation:

```bash
gpte my-new-project
```

4. Improve later:

```bash
gpte my-new-project -i
```

## B) Local Web UI mode (recommended for new users)

From the repository root:

```bash
python -m gpt_engineer.applications.web_local.server --open
```

This opens `http://127.0.0.1:8765`.

In the UI:

1. Enter **Project folder** (must exist)
2. Enter **Prompt**
3. Choose **LLM provider**
4. Optional: set **model**
5. Choose mode:
   - `Generate`
   - `Improve existing project`
6. Click **Run**

During run, use Interaction controls to send extra input (`y`, `n`, or text).

## C) Electron desktop app

From repository root:

```bash
cd electron
npm install
npm start
```

Electron starts the same local web app in a desktop window.

---

## 5) First project walkthrough (copy/paste)

### Step 1: Create folder + prompt

#### macOS / Linux

```bash
mkdir -p projects/hello-web
cat > projects/hello-web/prompt << 'EOF'
Create a minimal Python CLI app that:
- asks for a name
- prints a friendly greeting
- includes a README with run instructions
Also include one simple test.
EOF
```

#### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path projects/hello-web | Out-Null
@"
Create a minimal Python CLI app that:
- asks for a name
- prints a friendly greeting
- includes a README with run instructions
Also include one simple test.
"@ | Set-Content -Path projects/hello-web/prompt
```

### Step 2: Run GPT Engineer

```bash
gpte projects/hello-web
```

### Step 3: Check outputs

Look in:

- `projects/hello-web/workspace`
- `projects/hello-web/memory`

### Step 4: Ask for improvement

Update `projects/hello-web/prompt` with a follow-up instruction, then run:

```bash
gpte projects/hello-web -i
```

---

## 6) Common flags you will use

- Choose model:

```bash
gpte <project_dir> --model gpt-4o
```

- Lower randomness:

```bash
gpte <project_dir> --temperature 0.1
```

- Improve mode:

```bash
gpte <project_dir> -i
```

- Help:

```bash
gpte --help
```

---

## 7) Troubleshooting

## Issue: `pip install gpt-engineer` fails

- Confirm Python version is supported (3.10–3.12).
- Upgrade pip:
  ```bash
  python -m pip install --upgrade pip
  ```
- Retry install.

## Issue: `gpte` command not found

- If using Poetry dev setup, activate shell first:
  ```bash
  poetry shell
  ```
- Or run with Poetry explicitly:
  ```bash
  poetry run gpte --help
  ```

## Issue: API key errors

- Verify env var exists in current terminal session.
- Restart terminal after changing persistent environment variables.

## Issue: Local Web UI says provider config is invalid

- OpenRouter requires API key.
- Private server requires base URL (`http://.../v1`).

## Issue: Electron opens but backend fails

- Confirm Python env has project dependencies installed.
- Start Web UI manually first to confirm backend:
  ```bash
  python -m gpt_engineer.applications.web_local.server --open
  ```

---

## 8) What to do next

- Read model/provider details in `docs/open_models.md`.
- Explore examples under `projects/`.
- Use `--improve` for iterative development after first generation.

By running GPT Engineer, you agree to the terms in `TERMS_OF_USE.md`.
