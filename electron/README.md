# GPT Engineer Electron Wrapper

This folder provides a local Electron desktop shell for the web UI at `gpt_engineer/applications/web_local`.

For a complete first-time setup walkthrough, see `docs/NEW_USER_HOWTO.md`.

## Run

1. Install Python dependencies for `gpt-engineer` (Poetry or pip install editable).
2. Install Node dependencies:
   - `cd electron`
   - `npm install`
3. Start the app:
   - `npm start`

## Production packaging (standalone)

From the `electron` folder:

1. Install dependencies:
   - `npm install`
2. Build bundled backend binaries:
   - `npm run build:backend`
3. Build unpacked app (sanity check):
   - `npm run pack`
4. Build installer/package artifacts:
   - `npm run dist`

Build outputs are written to `electron/dist/`.

## CI release (Windows standalone installer)

- Workflow: `.github/workflows/electron-release.yaml`
- Trigger: push a tag like `electron-v0.1.0` (or run manually from Actions)
- Output assets attached to the GitHub Release:
  - `GPT Engineer Setup <version>.exe`
  - `GPT Engineer Setup <version>.exe.blockmap`
  - `latest.yml`

## Notes

- In development (`npm start`), the app starts the Python web server on `http://127.0.0.1:8765`.
- You can set `PYTHON_EXECUTABLE` if `python` is not the right command on your machine.
- Installer builds bundle `gpte-web-backend` and `gpte-cli` executables into app resources.
- Bundled backend executables also include the web UI static assets, so packaged apps serve `/` without source files.
- End users of the packaged installer do **not** need Python installed.
