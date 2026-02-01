import { spawnSync } from "node:child_process";

const shadowUrl = process.env.SHADOW_DATABASE_URL;
if (!shadowUrl) {
  console.error("SHADOW_DATABASE_URL is not set.");
  process.exit(1);
}

const containerName = process.env.PRISMA_SHADOW_CONTAINER || "stylenya_db";

let url;
try {
  url = new URL(shadowUrl);
} catch {
  console.error("Invalid SHADOW_DATABASE_URL.");
  process.exit(1);
}

const dbName = url.pathname.replace(/^\//, "");
const user = decodeURIComponent(url.username || "stylenya");
const password = decodeURIComponent(url.password || "");

if (!dbName) {
  console.error("Shadow database name is missing in SHADOW_DATABASE_URL.");
  process.exit(1);
}

const sql = `DROP DATABASE IF EXISTS "${dbName}"; CREATE DATABASE "${dbName}";`;

const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    "-e",
    `PGPASSWORD=${password}`,
    containerName,
    "psql",
    "-U",
    user,
    "-d",
    "postgres",
    "-c",
    sql,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
