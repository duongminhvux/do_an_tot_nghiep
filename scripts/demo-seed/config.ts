export const NAMESPACE = "vocalearn.synthetic.v1";
export const PROFILES = { small: 50, standard: 1000, large: 5000 };
export function config(env: NodeJS.ProcessEnv = process.env) {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key] === "" ? fallback : (env[key] ?? fallback));
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw new Error(`${key} must be an integer in ${min}..${max}`);
    return value;
  };
  const boolean = (key: string) => {
    if (env[key] !== undefined && !["true", "false"].includes(env[key]!))
      throw new Error(`${key} must be true or false`);
    return env[key] === "true";
  };
  const profile = env.DEMO_PROFILE ?? "standard";
  if (!(profile in PROFILES)) throw new Error("Invalid DEMO_PROFILE");
  const users = integer(
    "DEMO_USER_COUNT",
    PROFILES[profile as keyof typeof PROFILES],
    2,
    5000,
  );
  const loginCount = integer(
    "DEMO_LOGIN_COUNT",
    env.DEMO_LOGIN_PASSWORD ? 1 : 0,
    0,
    Math.min(users, 5),
  );
  if (
    loginCount &&
    (!env.DEMO_LOGIN_PASSWORD || env.DEMO_LOGIN_PASSWORD.length < 16)
  )
    throw new Error("DEMO_LOGIN_PASSWORD requires at least 16 characters");
  const simulator = boolean("DEMO_SIMULATOR_ENABLED");
  if (simulator)
    throw new Error(
      "Periodic simulator is not installed; keep DEMO_SIMULATOR_ENABLED=false",
    );
  return {
    namespace: NAMESPACE,
    profile,
    users,
    days: integer("DEMO_HISTORY_DAYS", 90, 7, 180),
    seed: integer("DEMO_SEED_RANDOM", 2026, 1, 2147483647),
    matches: integer("DEMO_ARENA_MATCH_COUNT", users * 2, 0, 10000),
    enabled: boolean("DEMO_SEED_ENABLED"),
    simulator,
    loginCount,
    environment: env.DEMO_ENVIRONMENT ?? "",
    host: env.PGHOST ?? "127.0.0.1",
    maxRecords: integer("DEMO_MAX_RECORDS", 1000000, 1000, 2000000),
  };
}
export type DemoConfig = ReturnType<typeof config>;
export function sameConfig(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
) {
  return (
    Object.keys(expected).length === Object.keys(actual).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
  );
}
export function assertSafe(
  c: DemoConfig,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!c.enabled)
    throw new Error("Demo writes disabled: set DEMO_SEED_ENABLED=true");
  if (!["local", "development", "test"].includes(c.environment))
    throw new Error("Set DEMO_ENVIRONMENT=local, development or test");
  if (!["127.0.0.1", "localhost", "::1", "postgres"].includes(c.host))
    throw new Error("Demo writes require a local PostgreSQL host");
  if (env.DATABASE_URL || env.DEMO_PRODUCTION === "true")
    throw new Error("Refusing ambiguous DATABASE_URL or production target");
}
