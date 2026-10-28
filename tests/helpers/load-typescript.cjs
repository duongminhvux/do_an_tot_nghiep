const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const cache = new Map();

/** Load application TS with Nest's production decorator settings, without a build artifact. */
module.exports = function loadTypeScript(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  const nodeRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id.startsWith(".")) {
      const candidate = path.resolve(
        path.dirname(filename),
        id.replace(/\.js$/, ".ts"),
      );
      if (fs.existsSync(candidate)) return module.exports(candidate);
    }
    return nodeRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
    },
  }).outputText;
  loaded._compile(output, filename);
  return loaded.exports;
};
