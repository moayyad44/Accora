import fs from "node:fs";
import path from "node:path";

export interface EmbeddedPg {
  stop(): Promise<void>;
}

/**
 * Starts (initialising on first run) a local, embedded PostgreSQL cluster
 * dedicated to this desktop install — its data directory lives under
 * Electron's per-user app data folder, so it persists across restarts the
 * same way the Docker volume does for the server deployment, but needs no
 * Docker/Postgres install on the user's machine at all.
 */
export async function startEmbeddedPostgres(options: {
  dataDir: string;
  port: number;
  password: string;
  onLog: (message: string) => void;
}): Promise<{ pg: EmbeddedPg; databaseUrl: string; shadowDatabaseUrl: string }> {
  const { dataDir, port, password, onLog } = options;

  // ESM-only package — dynamic import from this CommonJS module.
  const { default: EmbeddedPostgres } = await import("embedded-postgres");

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port,
    user: "postgres",
    password,
    persistent: true,
    onLog,
    onError: (messageOrError: unknown) => onLog(String(messageOrError)),
    // Postgres refuses to run its binaries as root. Real end users never
    // run as root, so this only ever applies in a root CI/sandbox test run.
    createPostgresUser: process.env.ACCORA_DESKTOP_ALLOW_ROOT_PG === "1",
  });

  const alreadyInitialised = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!alreadyInitialised) {
    onLog("Initializing local database (first run only)...");
    await pg.initialise();
  }

  onLog("Starting local database...");
  await pg.start();

  try {
    await pg.createDatabase("accora_dev");
  } catch {
    // Already exists on every run after the first — expected, not an error.
  }
  try {
    await pg.createDatabase("accora_shadow");
  } catch {
    // Same as above; only used transiently by `prisma migrate dev`, not
    // `migrate deploy`, but Prisma still validates the env var is set.
  }

  const auth = `postgres:${encodeURIComponent(password)}`;
  return {
    pg,
    databaseUrl: `postgresql://${auth}@127.0.0.1:${port}/accora_dev?schema=public`,
    shadowDatabaseUrl: `postgresql://${auth}@127.0.0.1:${port}/accora_shadow?schema=public`,
  };
}
