/** Detect the document query API using TypeScript syntax, not SQL $1 parameters. */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const sourceIndex = process.argv.indexOf("--source");
const sourceRoot =
  sourceIndex >= 0
    ? path.resolve(root, process.argv[sourceIndex + 1])
    : path.join(root, "apps/api/src");
const nativeFiles = new Set([
  "common/media/audio-sql.ts",
  "internal/audio-owner-sync.module.ts",
  "modules/admins/admins.service.ts",
  "modules/vocabulary/content-sql.repository.ts",
  "modules/vocabulary/groups/vocabulary-groups.service.ts",
  "modules/vocabulary/collections/collections.service.ts",
  "modules/vocabulary/lessons/lessons.service.ts",
  "modules/vocabulary/words/words.service.ts",
]);
const methods = new Set([
  "find",
  "save",
  "create",
  "insertMany",
  "distinct",
  "toObject",
  "findOne",
  "findById",
  "findOneAndUpdate",
  "findByIdAndUpdate",
  "findOneAndDelete",
  "findByIdAndDelete",
  "findOneAndRemove",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "estimatedDocumentCount",
  "aggregate",
  "bulkWrite",
  "populate",
  "lean",
  "exec",
]);
function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(location);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts"))
      yield location;
  }
}
const files = [...walk(sourceRoot)];
const configPath = path.resolve(sourceRoot, "../tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
  );
const options = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configPath),
).options;
const program = ts.createProgram(files, {
  ...options,
  noEmit: true,
  incremental: false,
});
const checker = program.getTypeChecker();
function legacyType(type, seen = new Set()) {
  if (seen.has(type)) return false;
  seen.add(type);
  const symbol = type.aliasSymbol || type.getSymbol();
  if (
    symbol?.declarations?.some((declaration) =>
      /[\\/]postgres[\\/]compat\.ts$/.test(
        declaration.getSourceFile().fileName,
      ),
    )
  )
    return true;
  return !!type.types?.some((part) => legacyType(part, seen));
}
const findings = [];
for (const location of files) {
  const file = path.relative(sourceRoot, location).replaceAll("\\", "/");
  const source = program.getSourceFile(location);
  if (!source) throw new Error("Cannot parse " + location);
  const entry = {
    file,
    compatImports: 0,
    modelInjections: 0,
    operators: 0,
    methods: 0,
    locations: [],
  };
  const record = (node, kind, value) => {
    entry[kind]++;
    entry.locations.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      kind,
      value,
    });
  };
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /postgres\/compat\.js$/.test(node.moduleSpecifier.text)
    )
      record(node, "compatImports", node.moduleSpecifier.text);
    if (
      ts.isPropertyAssignment(node) &&
      node.name &&
      /^\$[A-Za-z]/.test(node.name.getText(source).replace(/^['"]|['"]$/g, ""))
    )
      record(node, "operators", node.name.getText(source));
    if (
      ts.isPropertyAccessExpression(node) &&
      /^\$[A-Za-z]/.test(node.name.text)
    )
      record(node, "operators", node.name.text);
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "InjectPgModel"
      )
        record(node, "modelInjections", "InjectPgModel");
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        methods.has(node.expression.name.text) &&
        legacyType(checker.getTypeAtLocation(node.expression.expression))
      )
        record(node, "methods", node.expression.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (entry.locations.length) findings.push(entry);
}
const runtime = findings.filter((entry) => entry.file !== "postgres/compat.ts");
const totals = Object.fromEntries(
  ["compatImports", "modelInjections", "operators", "methods"].map((kind) => [
    kind,
    runtime.reduce((sum, entry) => sum + entry[kind], 0),
  ]),
);
const nativeViolations = findings.filter((entry) =>
  nativeFiles.has(entry.file),
);
const report = {
  complete:
    !fs.existsSync(path.join(sourceRoot, "postgres/compat.ts")) &&
    !findings.length,
  note: "Counts exclude specs/comments and SQL parameter strings. Method calls are counted only when their receiver type is declared in compat.ts; untyped any receivers require manual review.",
  totals,
  filesRemaining: runtime.length,
  nativeFiles: [...nativeFiles],
  nativeViolations,
  findings,
};
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0)
  fs.writeFileSync(
    path.resolve(root, process.argv[outputIndex + 1]),
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(
  JSON.stringify(
    {
      complete: report.complete,
      totals,
      filesRemaining: report.filesRemaining,
      migratedFiles: nativeFiles.size,
      nativeViolations: nativeViolations.length,
    },
    null,
    2,
  ),
);
if (
  nativeViolations.length ||
  (process.argv.includes("--check-complete") && !report.complete)
)
  process.exitCode = 1;
