import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({ plugins:[react()],test:{environment:"jsdom",setupFiles:["./src/test/setup.ts"],include:["src/**/*.test.{ts,tsx}"]},resolve:{alias:[{find:"@listenup/domain/permissions",replacement:path.resolve(__dirname,"../../packages/domain/permissions.ts")},{find:"@listenup/domain",replacement:path.resolve(__dirname,"../../packages/domain/index.ts")},{find:"@listenup/auth",replacement:path.resolve(__dirname,"../../packages/auth/index.ts")},{find:"@",replacement:path.resolve(__dirname,"./src")}]}});
