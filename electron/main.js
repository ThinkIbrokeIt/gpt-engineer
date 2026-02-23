const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 8765;
const SERVER_URL = `http://${HOST}:${PORT}`;

let backendProcess = null;

function waitForServerReady(retries = 40, intervalMs = 250) {
  return new Promise((resolve, reject) => {
    const tryConnect = (remaining) => {
      const req = http.get(`${SERVER_URL}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else if (remaining > 0) {
          setTimeout(() => tryConnect(remaining - 1), intervalMs);
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });

      req.on("error", () => {
        if (remaining > 0) {
          setTimeout(() => tryConnect(remaining - 1), intervalMs);
        } else {
          reject(new Error("Timed out waiting for local web server"));
        }
      });
    };

    tryConnect(retries);
  });
}

function startBackend() {
  const backendDir = app.isPackaged
    ? path.join(process.resourcesPath, "backend")
    : path.join(__dirname, "backend", "dist");

  const backendExeName = process.platform === "win32" ? "gpte-web-backend.exe" : "gpte-web-backend";
  const cliExeName = process.platform === "win32" ? "gpte-cli.exe" : "gpte-cli";

  const backendExecutable = path.join(backendDir, backendExeName);
  const cliExecutable = path.join(backendDir, cliExeName);
  const hasBundledCli = fs.existsSync(cliExecutable);

  const backendArgs = ["--host", HOST, "--port", String(PORT)];

  if (!app.isPackaged) {
    const pythonCmd = process.env.PYTHON_EXECUTABLE || "python";
    const serverScript = path.join(__dirname, "..", "gpt_engineer", "applications", "web_local", "server.py");
    backendProcess = spawn(pythonCmd, [serverScript, ...backendArgs], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...(hasBundledCli ? { GPTE_CLI_EXECUTABLE: cliExecutable } : {}),
      },
    });
  } else {
    backendProcess = spawn(backendExecutable, backendArgs, {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        GPTE_CLI_EXECUTABLE: cliExecutable,
      },
    });
  }

  backendProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Backend exited with code ${code}`);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(SERVER_URL);
}

app.whenReady().then(async () => {
  startBackend();
  await waitForServerReady();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});
