import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  migrationsFor,
  DATABASES,
  migrationSetChecksum,
  schemaFingerprint,
} from "../apps/api/src/postgres/migrations.ts";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const includePublication=process.argv.includes('--publication');
const includeMistakes = process.argv.includes("--mistakes");
const { Pool } = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("pg");
const name = `vocalearn-f01-test-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
function docker(args) {
  const result = spawnSync("docker", args, {
    cwd,
    windowsHide: true,
    encoding: "utf8",
    env: { ...process.env, POSTGRES_PASSWORD: password },
  });
  if (result.status !== 0)
    throw new Error(result.stderr || "Docker command failed");
  return result.stdout.trim();
}
let admin,
  started = false;
const pools = [];
try {
  docker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD",
    "-p",
    "127.0.0.1::5432",
    "postgres:17-alpine",
  ]);
  started = true;
  const port = Number(docker(["port", name, "5432/tcp"]).split(":").at(-1));
  const url = (database) =>
    `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  admin = new Pool({ connectionString: url("postgres") });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await admin.query("SELECT 1");
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  if (!ready) throw new Error("Test PostgreSQL did not become ready");
  const env = { ...process.env };
  for (const role of ["learning", "assessment", "content", "media-jobs"]) {
    const database = DATABASES[role];
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: url(database) });
    pools.push(pool);
    const migrations = await migrationsFor(role);
    for (const migration of migrations) await pool.query(migration.sql);
    if (
      (role === "learning" && process.argv.includes("--write-learning-contract")) ||
      (["content","assessment"].includes(role) && process.argv.includes("--write-publication-contracts"))
    ) {
      // This database was just created in our disposable container, never a live owner.
      const contract = {
        version: migrations.at(-1).version,
        migrationsChecksum: migrationSetChecksum(migrations),
        fingerprint: await schemaFingerprint(pool),
      };
      const path = new URL(
        "../database/postgres/migrations/contracts.json",
        import.meta.url,
      );
      const previous = await readFile(path, "utf8");
      await writeFile(
        path,
        previous.replace(
          new RegExp(`"${role}":\\s*\\{[^}]+\\}`),
          `"${role}": ${JSON.stringify(contract)}`,
        ),
      );
      console.log(
        `Updated ${role} schema contract from a fresh disposable owner database.`,
      );
    }
    if (["learning","content","assessment"].includes(role)) {
      const contracts = JSON.parse(
        await readFile(
          new URL(
            "../database/postgres/migrations/contracts.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      assert.deepEqual(
        {
          version: migrations.at(-1).version,
          migrationsChecksum: migrationSetChecksum(migrations),
          fingerprint: await schemaFingerprint(pool),
        },
        contracts[role],
        `${role} schema contract must match the fresh migration reference`,
      );
    }
    env[`F01_${role.replaceAll("-", "_").toUpperCase()}_TEST_DATABASE_URL`] =
      url(database);
  }
  console.log(
    `${includePublication ? "F01/F02/F10" : includeMistakes ? "F01/F02" : "F01"} integration: four isolated owner databases; disposable fixtures`,
  );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../apps/api/node_modules/vitest/vitest.mjs", import.meta.url),
      ),
      "run",
      "src/modules/learning/recommendations",
      ...(includeMistakes ? ["src/modules/learning/mistakes"] : []),
      ...(includePublication ? ["src/modules/publication"] : []),
      "src/modules/site-settings/site-settings.spec.ts",
      "src/modules/auth/guards/jwt-auth.guard.spec.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../apps/api/", import.meta.url)),
      windowsHide: true,
      stdio: "inherit",
      env,
    },
  );
  process.exitCode = result.status ?? 1;
  if(includePublication && result.status===0) {
    const concurrency=spawnSync(process.execPath,[fileURLToPath(new URL('../tests/postgres-attempt-concurrency.mjs',import.meta.url))],{
      cwd,windowsHide:true,stdio:'inherit',env:{...env,SERVICE_ROLE:'assessment'},
    });
    process.exitCode=concurrency.status??1;
  }
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  if (admin) await admin.end();
  if (started) docker(["stop", name]);
}
