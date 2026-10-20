import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Check dictionary parity, interpolation variables, and statically named t() keys.
const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const languages = ['vi', 'en'];
const namespaces = fs.readdirSync(path.join(root, 'locales/vi')).filter((name) => name.endsWith('.json'));
const resources = {};
const errors = [];
function flatten(value, prefix = '', output = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') output[fullKey] = entry;
    else if (entry && typeof entry === 'object') {
      if (Array.isArray(entry)) output[fullKey] = JSON.stringify(entry);
      flatten(entry, fullKey, output);
    }
    else errors.push(`Invalid translation: ${fullKey}`);
  }
  return output;
}
function variables(value) {
  return [...value.matchAll(/{{\s*([^},]+)(?:,[^}]+)?\s*}}/g)].map((match) => match[1].trim()).sort().join(',');
}
for (const language of languages) {
  resources[language] = {};
  const available = fs.readdirSync(path.join(root, 'locales', language)).filter((name) => name.endsWith('.json'));
  for (const name of new Set([...namespaces, ...available])) {
    if (!namespaces.includes(name) || !available.includes(name)) errors.push(`${language}: unmatched namespace ${name}`);
    if (available.includes(name)) resources[language][name.slice(0, -5)] = flatten(JSON.parse(fs.readFileSync(path.join(root, 'locales', language, name), 'utf8')));
  }
}
for (const name of namespaces) {
  const ns = name.slice(0, -5);
  const vi = resources.vi[ns];
  const en = resources.en[ns] || {};
  for (const key of new Set([...Object.keys(vi), ...Object.keys(en)])) {
    if (!(key in vi) || !(key in en)) errors.push(`${ns}:${key}: missing translation`);
    else if (variables(vi[key]) !== variables(en[key])) errors.push(`${ns}:${key}: interpolation variables differ`);
  }
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.[jt]sx?$/.test(file) ? [file] : [];
  });
}
let checkedKeys = 0;
for (const file of ['app', 'components', 'hooks', 'features'].flatMap((directory) => fs.existsSync(path.join(root, directory)) ? walk(path.join(root, directory)) : [])) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relative = path.relative(root, file).replaceAll('\\', '/');
  // Child components receive the page's translator through their t prop.
  const inheritedNamespace = relative.includes('/vocabulary/') ? 'vocabulary'
    : relative.includes('/toeic/') ? 'toeic'
    : relative.includes('/(dashboard)/components/') ? 'home' : 'common';
  const bindings = new Map();
  function findTranslators(node) {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'useTranslation') {
      const argument = node.initializer.arguments[0];
      if (!argument || ts.isStringLiteral(argument)) {
        for (const element of node.name.elements) {
          if ((element.propertyName || element.name).getText(source) === 't') bindings.set(element.name.getText(source), argument?.text || 'common');
        }
      }
    }
    ts.forEachChild(node, findTranslators);
  }
  findTranslators(source);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const argument = node.arguments[0];
      if ((bindings.has(name) || name === 't') && argument && ts.isStringLiteral(argument)) {
        const key = argument.text;
        const [ns, translationKey] = key.includes(':') ? key.split(':') : [bindings.get(name) || inheritedNamespace, key];
        checkedKeys++;
        for (const language of languages) {
          if (!(translationKey in (resources[language][ns] || {}))) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            errors.push(`${relative}:${line}: ${language} missing ${ns}:${translationKey}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Web i18n OK: ${namespaces.length} namespaces, ${checkedKeys} static translation calls, matching vi/en keys and interpolation variables.`);
}
