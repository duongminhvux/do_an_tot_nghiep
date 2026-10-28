/** All literal frontend axios routes must reach a gateway owner and a matching HTTP endpoint.
 * Typed dynamic publication routes are expanded from PublicationKind's union.
 * Note: this checks static contracts, not authentication or live HTTP availability. */
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
const extraClient=process.argv.indexOf('--extra-client');
if(extraClient>=0)files.push(path.resolve(root,process.argv[extraClient+1]));
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
          let values=key==='kind' && file.endsWith('publication.service.ts')?publicationKinds:['placeholder'];
          for(let parent=node.parent;parent;parent=parent.parent){
            if(!ts.isMethodDeclaration(parent)&&!ts.isFunctionDeclaration(parent))continue;
            const parameter=parent.parameters.find(parameter=>parameter.name.getText(sf)===key);
            if(parameter?.type&&ts.isUnionTypeNode(parameter.type)){
              const literals=parameter.type.types.filter(ts.isLiteralTypeNode).map(type=>type.literal).filter(ts.isStringLiteral).map(value=>value.text);
              if(literals.length===parameter.type.types.length)values=literals;
            }
            break;
          }
          possible=possible.flatMap(base=>values.map(v=>base+v+span.literal.text));
        }
      }
      for(const uri of possible) if(uri.startsWith('/')&&!uri.startsWith('//'))
        pairs.push([path.relative(root,file),uri,node.expression.name.text.toUpperCase()]);
    }
    ts.forEachChild(node,scan);
  }
  scan(sf);
}
const endpoints=[];
const decorators=node=>ts.canHaveDecorators(node)?ts.getDecorators(node)||[]:[];
const strings=node=>!node?['']:ts.isStringLiteral(node)?[node.text]:ts.isArrayLiteralExpression(node)?node.elements.flatMap(strings):[];
function controllers(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()){controllers(file);continue;}
    if(!file.endsWith('.ts')||file.endsWith('.spec.ts'))continue;
    const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
    const factoryKinds=[...source.text.matchAll(/resourceController\('([^']+)'\)/g)].map(match=>match[1]);
    const controllerStrings=arg=>arg&&ts.isIdentifier(arg)&&arg.text==='kind'?factoryKinds:strings(arg);
    function scan(node){
      if(ts.isClassDeclaration(node))for(const decorator of decorators(node)){
        const call=decorator.expression;
        if(!ts.isCallExpression(call)||!ts.isIdentifier(call.expression)||!['Controller','AdminController'].includes(call.expression.text))continue;
        const bases=controllerStrings(call.arguments[0]).map(base=>(call.expression.text==='AdminController'?'admin/':'')+base);
        for(const member of node.members)for(const route of decorators(member)){
          const handler=route.expression;
          if(!ts.isCallExpression(handler)||!ts.isIdentifier(handler.expression)||!['Get','Post','Put','Patch','Delete','Head','Options','All'].includes(handler.expression.text))continue;
          for(const base of bases)for(const suffix of strings(handler.arguments[0])){
            const path='/api/'+[base,suffix].filter(Boolean).join('/');
            const pattern=path.split('/').map(part=>part.startsWith(':')?'[^/]+':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/');
            endpoints.push({method:handler.expression.text.toUpperCase(),pattern:new RegExp('^'+pattern+'/?$')});
          }
        }
      }
      // Publication factory applies publish/unpublish decorators programmatically.
      if(ts.isCallExpression(node)&&ts.isCallExpression(node.expression)&&ts.isIdentifier(node.expression.expression)
        &&node.expression.expression.text==='Post'&&node.arguments[0]?.getText(source)==='ResourcePublicationController.prototype'){
        let kinds=factoryKinds;
        for(let parent=node.parent;parent;parent=parent.parent){
          if(ts.isIfStatement(parent)&&parent.expression.getText(source)==="kind !== 'dictation'")kinds=kinds.filter(kind=>kind!=='dictation');
        }
        for(const kind of kinds)for(const suffix of strings(node.expression.arguments[0])){
          const pattern=('/api/admin/'+kind+'/'+suffix).replace(/:\w+/g,'[^/]+');
          endpoints.push({method:'POST',pattern:new RegExp('^'+pattern+'/?$')});
        }
      }
      ts.forEachChild(node,scan);
    }scan(source);
  }
}
controllers(path.join(root,'apps/api/src'));
const unmatched=[],missingEndpoints=[];
for (const [file,uri,method] of pairs) {
  const route='/api'+uri.replace(/\?.*$/,'');
  if(!rules.some(([re])=>re.test(route)) && !uri.startsWith('/api/_internal/'))
    unmatched.push([file,uri]);
  if(!endpoints.some(endpoint=>(endpoint.method===method||endpoint.method==='ALL')&&endpoint.pattern.test(route)))
    missingEndpoints.push([file,method,uri]);
}
console.log(`Client route variants: ${pairs.length}; unmatched: ${unmatched.length}`);
for (const entry of unmatched.slice(0,100)) console.error('UNMATCHED', entry.join('  '));
console.log(`Client HTTP endpoint variants: ${pairs.length}; unmatched: ${missingEndpoints.length}`);
for(const entry of missingEndpoints.slice(0,100))console.error('MISSING ENDPOINT',entry.join('  '));
if(unmatched.length||missingEndpoints.length)process.exitCode=1;
