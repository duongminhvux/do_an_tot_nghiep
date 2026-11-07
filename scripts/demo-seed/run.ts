import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { NAMESPACE, sameConfig } from "./config.ts";
import { digest, generate, stableId, type Row } from "./generator.ts";
import {
  bootstrap,
  assertSafe,
  connect,
  inputContent,
  businessLogic,
  persist,
  requireApi,
  root,
} from "./runtime.ts";
import { reset } from "./reset.ts";
import { verify } from "./verify.ts";
import { prepareContent, verifyApi } from "./api.ts";

const command = process.argv[2] ?? "seed";
let session: Awaited<ReturnType<typeof connect>> | undefined;
try {
  const c = await bootstrap();
  if (!["seed", "plan", "verify", "reset", "content", "api"].includes(command))
    throw new Error("Expected seed, plan, verify, reset, content or api");
  if (
    ["seed", "content"].includes(command) ||
    (command === "reset" && !process.argv.includes("--dry-run"))
  )
    assertSafe(c);
  if (command === "content") {
    await prepareContent();
  } else if (command === "api") {
    const result = await verifyApi();
    await save("api", result);
    console.log(
      JSON.stringify({ apiRoutes: Object.keys(result), passed: true }),
    );
  } else {
    session = await connect(c);
    const db = session.clients;
    if (command === "reset") {
      const apply =
        process.argv.includes(`--confirm=${NAMESPACE}`) &&
        !process.argv.includes("--dry-run");
      if (!process.argv.includes("--dry-run") && !apply)
        throw new Error(
          `Reset defaults to refusal. Preview with --dry-run; deletion requires --confirm=${NAMESPACE}`,
        );
      const result = await reset(db, apply);
      await save("cleanup", result);
      console.log(JSON.stringify(result));
    } else {
      const input = await inputContent(db),
        business = await businessLogic();
      // Retain a stable time anchor in an existing owned record. No new schema or hidden side database.
      const first = (
        await db.identity.query("SELECT * FROM users WHERE id=$1", [
          stableId("user:0"),
        ])
      ).rows[0];
      if (first && first.payload?.demo !== NAMESPACE)
        throw new Error("Demo user UUID collides with non-demo data");
      if (
        first?.payload?.demoManifest &&
        !process.env.DEMO_LOGIN_COUNT &&
        !process.env.DEMO_LOGIN_PASSWORD
      )
        c.loginCount = first.payload.demoManifest.config.loginCount;
      const logicalConfig = {
        version: 1,
        seed: c.seed,
        users: c.users,
        days: c.days,
        matches: c.matches,
        loginCount: c.loginCount,
      };
      // Mutable admin timestamps and validation metadata are deliberately excluded from the input fingerprint.
      const contentHash = digest(
        JSON.parse(
          JSON.stringify(input, (k, v) =>
            [
              "payload",
              "created_at",
              "updated_at",
              "publication_validation",
              "published_at",
              "published_by",
            ].includes(k)
              ? undefined
              : v,
          ),
        ),
      );
      const manifest = first?.payload?.demoManifest ?? {
        config: logicalConfig,
        contentHash,
        anchor: process.env.DEMO_ANCHOR_DATE ?? new Date().toISOString(),
      };
      if (
        !Number.isFinite(Date.parse(manifest.anchor)) ||
        Date.parse(manifest.anchor) > Date.now() + 60000
      )
        throw new Error("Invalid/future DEMO_ANCHOR_DATE");
      if (
        !sameConfig(logicalConfig, manifest.config) ||
        manifest.contentHash !== contentHash
      )
        throw new Error(
          "Existing demo configuration/content differs. Use original settings or review cleanup --dry-run before reseeding.",
        );
      const plan = generate(c, input, manifest.anchor, business);
      plan.identity!.users![0]!.payload.demoManifest = manifest;
      const expected = Object.fromEntries(
        Object.entries(plan).map(([owner, tables]) => [
          owner,
          Object.fromEntries(
            Object.entries(tables).map(([table, rows]) => [table, rows.length]),
          ),
        ]),
      );
      if (command === "plan") {
        await save("plan", { manifest, expected });
        console.log(JSON.stringify({ manifest, expected }));
      } else {
        let inserted;
        if (command === "seed") {
          const bcrypt = requireApi("bcrypt");
          const existing = new Set(
            (
              await db.identity.query(
                "SELECT id FROM users WHERE payload->>'demo'=$1",
                [NAMESPACE],
              )
            ).rows.map((u: Row) => u.id),
          );
          const missing = plan
            .identity!.users!.map((user, i) => ({ user, i }))
            .filter(({ user }) => !existing.has(user.id));
          for (let offset = 0; offset < missing.length; offset += 8) {
            await Promise.all(
              missing.slice(offset, offset + 8).map(async ({ user, i }) => {
                user.password_hash = await bcrypt.hash(
                  i < c.loginCount
                    ? process.env.DEMO_LOGIN_PASSWORD
                    : randomBytes(32).toString("base64url"),
                  10,
                );
              }),
            );
            if (offset % 200 === 0)
              console.log(
                JSON.stringify({
                  credentialProgress: Math.min(offset + 8, missing.length),
                  total: missing.length,
                }),
              );
          }
          inserted = await persist(plan, db, business);
        }
        let actual;
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            actual = await verify(plan, db, business);
            break;
          } catch (error) {
            if (
              attempt === 9 ||
              !String(error).includes("projection not ready")
            )
              throw error;
            await delay(2000);
          }
        }
        await save(command, {
          manifest,
          expected,
          actual,
          inserted,
          passed: true,
        });
        console.log(JSON.stringify({ passed: true, actual }));
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await session?.close();
}
async function save(name: string, value: Row) {
  const dir = resolve(root, "scripts/demo-seed/reports");
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, `${name}.json`),
    JSON.stringify(
      { ...value, recordedAt: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
}
