#!/usr/bin/env node
// Prepares apps/desktop/resources/{api,web} for electron-builder's
// `extraResources` (see ../electron-builder.yml). electron-builder copies
// files verbatim and doesn't understand pnpm's symlinked `.pnpm` virtual
// store (and pnpm's own `deploy` command still leaves symlinks pointing
// back into this monorepo's shared store when packages are deduped there,
// which isn't portable to an end user's machine). So instead we copy
// apps/api's built output into a standalone folder and run a plain `npm
// install` there — npm produces an ordinary, fully self-contained,
// symlink-free node_modules. The web side is just the Vite production
// build.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..");
const desktopDir = path.join(__dirname, "..");
const resourcesDir = path.join(desktopDir, "resources");
const apiSourceDir = path.join(repoRoot, "apps", "api");

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`);
  // On Windows, npm/pnpm are .cmd shims that execFileSync can't exec
  // directly without going through a shell.
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

console.log("Building apps/api...");
run("pnpm", ["--filter", "@accora/api", "run", "build"], repoRoot);

console.log("Building apps/web...");
run("pnpm", ["--filter", "@accora/web", "run", "build"], repoRoot);

rmSync(resourcesDir, { recursive: true, force: true });

// electron-builder's extraResources copier unconditionally drops any
// directory whose path is *exactly* "node_modules" relative to the copied
// root (a hardcoded rule in its file filter, with no config to disable it —
// see app-builder-lib's util/filter.js). Nesting everything one level
// deeper (resources/api/app/node_modules instead of resources/api/
// node_modules) sidesteps that check; src/main.ts's packaged apiDir
// resolution matches this "api/app" layout.
console.log("Copying apps/api's runtime files into resources/api/app...");
const apiResourceDir = path.join(resourcesDir, "api", "app");
mkdirSync(apiResourceDir, { recursive: true });
for (const entry of ["package.json", "dist", "prisma"]) {
  cpSync(path.join(apiSourceDir, entry), path.join(apiResourceDir, entry), { recursive: true });
}

// A plain `npm install` (no pnpm workspace involved) resolves this
// package.json's dependencies + devDependencies fresh, flat, and with no
// symlinks — exactly what's needed for the prisma/ts-node CLIs and the
// compiled API to run standalone once electron-builder copies this folder
// verbatim into the packaged app's resources.
console.log("Running npm install in resources/api (fresh, flat, portable node_modules)...");
run("npm", ["install", "--omit=optional", "--no-audit", "--no-fund"], apiResourceDir);

console.log("Generating Prisma Client (all bundled platform engines) inside resources/api...");
run(
  "node",
  [path.join(apiResourceDir, "node_modules", "prisma", "build", "index.js"), "generate", "--schema", "prisma/schema"],
  apiResourceDir,
);

const webDistDir = path.join(repoRoot, "apps", "web", "dist");
if (!existsSync(webDistDir)) {
  throw new Error(`apps/web build did not produce ${webDistDir}`);
}
console.log("Copying apps/web/dist -> resources/web...");
cpSync(webDistDir, path.join(resourcesDir, "web"), { recursive: true });

// apps/desktop's OWN node_modules (electron, embedded-postgres) also needs
// to be flat/symlink-free for electron-builder's packaging step — pnpm's
// isolated linker hides embedded-postgres's optional per-platform packages
// (e.g. @embedded-postgres/linux-x64) as private siblings that
// electron-builder's dependency scanner can't discover. This is separate
// from the resources/api npm install above (that one's for the bundled
// API runtime; this one's for the Electron app itself) and only needed for
// packaging — `pnpm install` remains the right tool for everyday dev work
// (npm run start), so this is deliberately not run automatically there.
console.log("Reinstalling apps/desktop's own node_modules with npm (flat, portable)...");
rmSync(path.join(desktopDir, "node_modules"), { recursive: true, force: true });
run("npm", ["install", "--no-audit", "--no-fund"], desktopDir);

console.log("Resources ready:", resourcesDir);
