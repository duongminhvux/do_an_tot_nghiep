const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const ts=require(require.resolve('typescript',{paths:[path.join(root,'apps/api'),root]}));
let total=0,err=[],broken=[];
function walk(dir){for(let ent of fs.readdirSync(dir,{withFileTypes:true})){
if(['node_modules','dist','.next','.turbo','__pycache__','storage'].includes(ent.name))continue;
const file=path.join(dir,ent.name);
if(ent.isDirectory())walk(file);
else if(/\.(ts|tsx)$/.test(file)&&!file.endsWith('.d.ts')){
const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
for(const diag of parsed.parseDiagnostics)err.push(file+': '+ts.flattenDiagnosticMessageText(diag.messageText,' '));
if(file.includes('/apps/api/src/')){
parsed.forEachChild(node=>{if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
const ref=node.moduleSpecifier.text;
if(!ref.startsWith('.'))return;
const out=path.resolve(path.dirname(file),ref);
const candidates=[out,out.replace(/\.js$/,'.ts'),out.replace(/\.js$/,'.tsx'),out.replace(/\.mjs$/,'.mts'),path.join(out,'index.ts')];
if(!candidates.some(f=>fs.existsSync(f)))broken.push(file+': '+ref);
}});
}
total++;
}}}
walk(root+'/apps');walk(root+'/packages');
console.log('Parsed TS/TSX',total,'Syntax errors',err.length,'Broken local API imports',broken.length);
for(const x of [...err,...broken].slice(0,35))console.log(x);
if(err.length||broken.length)process.exit(1);
