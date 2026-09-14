import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma is used only as the application ORM/client mapping.
 *
 * Database lifecycle is intentionally SQL-first:
 *   sql/database.sql -> PostgreSQL -> Prisma schema/client
 *
 * Do not add Prisma migrations or Prisma seed hooks here. A brand-new Docker
 * database is initialized by PostgreSQL from sql/database.sql and sql/seed.sql.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
