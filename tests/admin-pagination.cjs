/** Run with the Admin dependency tree (the cached Docker image also provides it). */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sourceRoot = process.env.ADMIN_SOURCE_ROOT || path.resolve(__dirname, '../apps/admin-web');
const requireUI = Module.createRequire(path.join(sourceRoot, 'package.json'));
const ts = requireUI('typescript');
const React = requireUI('react');
const { renderToStaticMarkup } = requireUI('react-dom/server');
const cache = new Map();

function load(file) {
  file = [file, file + '.ts', file + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert(file, 'UI source module must exist');
  if (cache.has(file)) return cache.get(file).exports;
  const module = new Module(file);
  cache.set(file, module);
  module.require = name => {
    if (name === 'next/navigation') return { useParams: () => ({ locale: 'vi' }) };
    if (name === 'react-i18next') return { useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }) };
    if (name.startsWith('@/')) return load(path.join(sourceRoot, name.slice(2)));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return requireUI(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  module._compile(compiled, file);
  return module.exports;
}

const { useListPagination } = load(path.join(sourceRoot, 'hooks/use-list-pagination.ts'));
const { ListPagination } = load(path.join(sourceRoot, 'components/ui/list-pagination.tsx'));
const { loadListPages } = load(path.join(sourceRoot, 'lib/load-list-pages.ts'));

test('page changes, shrinking data, filters and page size retain the right visible rows', () => {
  const original = Array.from({ length: 25 }, (_, i) => i);
  function Harness() {
    const [stage, setStage] = React.useState(0);
    const data = stage < 2 ? original : original.slice(0, 15);
    const pagination = useListPagination(data, stage < 3 ? 'all' : 'filtered');
    if (stage === 0) { pagination.setPage(3); setStage(1); return null; }
    if (stage === 1) { assert.deepEqual(pagination.items, [20, 21, 22, 23, 24]); setStage(2); return null; }
    if (stage === 2) { assert.equal(pagination.page, 2); assert.deepEqual(pagination.items, [10, 11, 12, 13, 14]); setStage(3); return null; }
    if (stage === 3) { assert.equal(pagination.page, 1); pagination.setPageSize(5); setStage(4); return null; }
    assert.equal(pagination.page, 1);
    assert.equal(pagination.pageSize, 5);
    assert.deepEqual(pagination.items, [0, 1, 2, 3, 4]);
    assert.equal(original.length, 25, 'pagination never mutates the ordering/selection source');
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
});

test('empty lists stay on page one and do not render navigation', () => {
  function Harness() {
    const pagination = useListPagination([]);
    assert.equal(pagination.page, 1);
    assert.deepEqual(pagination.items, []);
    return React.createElement(ListPagination, { pagination });
  }
  assert.equal(renderToStaticMarkup(React.createElement(Harness)), '');
});

test('list footers reuse Vocab numbered navigation with ellipsis and correct boundaries', () => {
  const pagination = { page: 1, pageSize: 10, totalPages: 25, totalItems: 245, setPage() {}, setPageSize() {} };
  const html = renderToStaticMarkup(React.createElement(ListPagination, { pagination }));
  const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
  const disabled = label => /\sdisabled(?:=|[\s>])/.test(buttons.find(button => button.includes(label)));
  assert(disabled('Previous page'));
  assert(!disabled('Next page'));
  assert(!html.includes('First page'));
  assert(!html.includes('Last page'));
  assert.equal(buttons.length, 8);
  assert.match(html, /Showing 1 - 10 of 245/);
  assert(html.includes('...'));
  assert.match(html, /aria-current="page"/);
});

test('ordering lists load every server page instead of stopping at 50/100 rows', async () => {
  const calls = [];
  const all = Array.from({ length: 205 }, (_, id) => ({ id }));
  const response = await loadListPages(async (page, limit) => {
    calls.push([page, limit]);
    return { data: { data: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit } };
  });
  assert.deepEqual(calls, [[1, 100], [2, 100], [3, 100]]);
  assert.deepEqual(response.data.data, all);
});

test('a failed later page does not silently return an incomplete ordering list', async () => {
  await assert.rejects(loadListPages(async page => {
    if (page === 2) throw new Error('Page unavailable');
    return { data: { data: Array(100).fill({ id: 1 }), total: 200 } };
  }), /Page unavailable/);
});
