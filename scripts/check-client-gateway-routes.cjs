/** All literal frontend axios routes must reach a gateway owner.
 * Typed dynamic publication routes are expanded from PublicationKind's union.
 * Note: this checks static routing, not whether HTTP requests succeed. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(require.resolve('typescript', { paths: [path.join(root, 'apps/api'), root] }));
const files = [];
for (const dir of ['apps/web', 'apps/admin-web']) {
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|tsx)$/.test(file)) files.push(file);
    }
  }
  walk(path.join(root, dir));
}
const nginx = fs.readFileSync(path.join(root, 'infra/gateway/nginx.conf'), 'utf8');
const rules = [...nginx.matchAll(/location\s+~\s+(\S+)\s*\{\s*set\s+\$service_target\s+([\w-]+):5000;\s*proxy_pass\s+http:\/\/\$service_target\$request_uri;/g)]
  .map((match) => [new RegExp(match[1]), match[2]]);
const typeSource = fs.readFileSync(path.join(root,'packages/shared-types/src/publication.d.mts'),'utf8');
const kindUnion = /export type PublicationKind\s*=([^;]+);/.exec(typeSource)?.[1] || '';
const publicationKinds = [...kindUnion.matchAll(/["']([^"']+)["']/g)].map(x=>x[1]);
if (!publicationKinds.length) throw new Error('PublicationKind union cannot be resolved');
const pairs = [];
for (const file of files) {
  const source = fs.readFileSync(file,'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function scan(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && ['apiClient','axios','api'].includes(node.expression.expression.text)
      && ['get','post','put','patch','delete'].includes(node.expression.name.text)
      && node.arguments.length) {
      const first=node.arguments[0];
      let possible=[];
      if(ts.isStringLiteral(first)) possible=[first.text];
      if(ts.isTemplateExpression(first)) {
        possible=[first.head.text];
        for(const span of first.templateSpans) {
          const key=ts.isIdentifier(span.expression)?span.expression.text:'';
          const values=key==='kind' && file.endsWith('publication.service.ts')
            ?publicationKinds:['placeholder'];
          possible=possible.flatMap(base=>values.map(v=>base+v+span.literal.text));
        }
      }
      for(const uri of possible) if(uri.startsWith('/')&&!uri.startsWith('//'))
        pairs.push([path.relative(root,file),uri]);
    }
    ts.forEachChild(node,scan);
  }
  scan(sf);
}
const unmatched=[];
for (const [file,uri] of pairs) {
  const route='/api'+uri.replace(/\?.*$/,'');
  if(!rules.some(([re])=>re.test(route)) && !uri.startsWith('/api/_internal/'))
    unmatched.push([file,uri]);
}
console.log(`Client route variants: ${pairs.length}; unmatched: ${unmatched.length}`);
for (const entry of unmatched.slice(0,100)) console.error('UNMATCHED', entry.join('  '));
if(unmatched.length)process.exitCode=1;
