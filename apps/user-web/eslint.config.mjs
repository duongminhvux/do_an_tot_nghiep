import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
const config=[{ignores:[".next/**","node_modules/**","coverage/**","next-env.d.ts","test-results/**"]},{files:["**/*.{ts,tsx}"],languageOptions:{parser,parserOptions:{ecmaVersion:"latest",sourceType:"module",ecmaFeatures:{jsx:true}}},plugins:{"@typescript-eslint":tsPlugin},rules:{"@typescript-eslint/no-explicit-any":"error","@typescript-eslint/no-unused-vars":["error",{argsIgnorePattern:"^_",varsIgnorePattern:"^_"}]}}];
export default config;
