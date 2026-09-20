import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import { startEmbeddedPostgres, type EmbeddedPg } from "./postgres";
import { startStaticServer } from "./static-server";

const isDev = !app.isPackaged;

// Resource layout: in dev, apps/api and apps/web live as siblings of
// apps/desktop in the monorepo. When packaged, electron-builder copies the
// pre-built `api` (full pnpm-deployed runtime, including node_modules) and
// `web` (Vite production build) directories into resourcesPath verbatim —
// see electron-builder.yml's `extraResources`.
// Packaged layout nests one level deeper (resources/api/app) than dev —
// see scripts/prepare-resources.mjs for why (electron-builder drops any
// top-level "node_modules" dir from extraResources otherwise).
const apiDir = isDev ? path.join(__dirname, "..", "..", "api") : path.join(process.resourcesPath, "api", "app");
const webDistDir = isDev ? path.join(__dirname, "..", "..", "web", "dist") : path.join(process.resourcesPath, "web");

const PG_PORT = 55432;
const PG_PASSWORD = "accora_desktop_local";
const API_PORT = 3011;
const STATIC_PORT = 4174;
const APP_USER_PASSWORD = "change_me_in_production"; // fixed by the RLS migration itself — see docs/DATABASE.md

let apiProcess: ChildProcess | null = null;
let embeddedPg: EmbeddedPg | null = null;
let loadingWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

function log(message: string) {
  console.log(`[accora-desktop] ${message}`);
  loadingWindow?.webContents.send("status", message);
}

function runNode(scriptPath: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "pipe",
    });
    child.stdout?.on("data", (d) => console.log(d.toString().trimEnd()));
    child.stderr?.on("data", (d) => console.error(d.toString().trimEnd()));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${scriptPath} exited with code ${code}`))));
  });
}

function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 2000 }, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          retry();
        }
      });
      req.on("error", retry);
      req.on("timeout", () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error("Backend did not become healthy in time"));
        return;
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: false,
    frame: false,
    center: true,
    backgroundColor: "#0f172a",
    // Loading window only ever loads our own bundled, trusted loading.html —
    // never remote content — so nodeIntegration here is safe and keeps the
    // splash's status updates simple (no preload/contextBridge needed).
    webPreferences: { contextIsolation: false, nodeIntegration: true },
  });
  loadingWindow.loadFile(path.join(__dirname, "..", "loading.html"));
}

async function bootstrap() {
  const userDataDir = app.getPath("userData");
  const pgDataDir = path.join(userDataDir, "pgdata");
  fs.mkdirSync(pgDataDir, { recursive: true });

  log("جاري تجهيز قاعدة البيانات...");
  const { pg, databaseUrl, shadowDatabaseUrl } = await startEmbeddedPostgres({
    dataDir: pgDataDir,
    port: PG_PORT,
    password: PG_PASSWORD,
    onLog: (m) => console.log(`[postgres] ${m}`),
  });
  embeddedPg = pg;

  const runtimeDatabaseUrl = `postgresql://app_user:${APP_USER_PASSWORD}@127.0.0.1:${PG_PORT}/accora_dev?schema=public`;

  log("جاري تحديث هيكل قاعدة البيانات...");
  const prismaCli = path.join(apiDir, "node_modules", "prisma", "build", "index.js");
  await runNode(prismaCli, ["migrate", "deploy", "--schema", path.join(apiDir, "prisma", "schema")], apiDir, {
    DATABASE_URL: databaseUrl,
    SHADOW_DATABASE_URL: shadowDatabaseUrl,
  });

  log("جاري تعبئة البيانات الأساسية...");
  const tsNodeCli = path.join(apiDir, "node_modules", "ts-node", "dist", "bin.js");
  await runNode(tsNodeCli, [path.join(apiDir, "prisma", "seed.ts")], apiDir, {
    DATABASE_URL: databaseUrl,
  });

  log("جاري تشغيل الخادم...");
  apiProcess = spawn(process.execPath, [path.join(apiDir, "dist", "src", "main.js")], {
    cwd: apiDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DATABASE_URL: databaseUrl,
      RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
      JWT_ACCESS_SECRET: "accora-desktop-access-secret",
      JWT_REFRESH_SECRET: "accora-desktop-refresh-secret",
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_TTL: "7d",
      PORT: String(API_PORT),
    },
    stdio: "pipe",
  });
  apiProcess.stdout?.on("data", (d) => console.log(`[api] ${d.toString().trimEnd()}`));
  apiProcess.stderr?.on("data", (d) => console.error(`[api] ${d.toString().trimEnd()}`));

  await waitForHealth(API_PORT, 60_000);

  log("جاري تحضير الواجهة...");
  await startStaticServer({ webDistDir, apiPort: API_PORT, staticPort: STATIC_PORT });

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    show: false,
    title: "Accora",
    webPreferences: { contextIsolation: true },
  });
  await mainWindow.loadURL(`http://127.0.0.1:${STATIC_PORT}/`);
  mainWindow.show();
  loadingWindow?.close();
  loadingWindow = null;

  // Dev/CI smoke-test hook only — proves the whole bootstrap chain (embedded
  // Postgres -> migrate -> seed -> API -> static+proxy server -> window)
  // actually rendered something, without shipping any test code in the
  // packaged app.
  if (process.env.ACCORA_DESKTOP_TEST_SCREENSHOT) {
    setTimeout(async () => {
      const image = await mainWindow!.webContents.capturePage();
      fs.writeFileSync(process.env.ACCORA_DESKTOP_TEST_SCREENSHOT!, image.toPNG());
      console.log(`[accora-desktop] screenshot saved to ${process.env.ACCORA_DESKTOP_TEST_SCREENSHOT}`);
      app.quit();
    }, 2500);
  }
}

app.whenReady().then(async () => {
  createLoadingWindow();
  try {
    await bootstrap();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox("Accora", `تعذّر تشغيل البرنامج:\n${err instanceof Error ? err.message : String(err)}`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function shutdown() {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
  if (embeddedPg) {
    await embeddedPg.stop();
    embeddedPg = null;
  }
}

app.on("before-quit", () => {
  void shutdown();
});
