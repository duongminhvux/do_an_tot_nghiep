/** Enforce native backend SQL; SQL parameter strings such as $1 are valid. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),sourceIndex=process.argv.indexOf('--source');
const sourceRoot=sourceIndex<0?path.join(root,'apps/api/src'):path.resolve(root,process.argv[sourceIndex+1]);
function* walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())yield* walk(file);else if(entry.name.endsWith('.ts')&&!entry.name.endsWith('.spec.ts'))yield file;}}
const symbols=new Set(['InjectPgModel','PgModelsModule','makePgModel','PgId','PgDocument','PgField','PgSchemaFactory','PgSchemaDefinition','PipelineStage','UpdateQuery']);
const legacyMethods=new Set(['aggregate','populate','lean','toObject','countDocuments','estimatedDocumentCount','findOneAndUpdate','findByIdAndUpdate','findOneAndDelete','findByIdAndDelete','updateOne','updateMany','deleteOne','deleteMany','insertMany','bulkWrite']);
const totals={compatImports:0,modelInjections:0,operators:0,methods:0,legacyDeclarations:0,legacySchemas:0},findings=[];
let scanned=0;
for(const location of walk(sourceRoot)){
  scanned++;const file=path.relative(sourceRoot,location).replaceAll('\\','/'),source=ts.createSourceFile(location,fs.readFileSync(location,'utf8'),ts.ScriptTarget.Latest,true),locations=[];
  const record=(node,kind,value)=>{totals[kind]++;locations.push({line:node?source.getLineAndCharacterOfPosition(node.getStart(source)).line+1:1,kind,value});};
  if(file.endsWith('.schema.ts'))record(null,'legacySchemas',file);
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)&&/(?:postgres\/compat(?:\.js)?$|^(?:mongoose|mongodb|bson|@nestjs\/mongoose)(?:\/|$))/.test(node.moduleSpecifier.text))record(node,'compatImports',node.moduleSpecifier.text);
    if(ts.isIdentifier(node)&&symbols.has(node.text))record(node,node.text==='InjectPgModel'?'modelInjections':'legacyDeclarations',node.text);
    if((ts.isPropertyAssignment(node)&&/^\$[a-z]/i.test(node.name.getText(source).replace(/^['"]|['"]$/g,'')))||(ts.isPropertyAccessExpression(node)&&/^\$[a-z]/i.test(node.name.text)))record(node,'operators',node.name.getText(source));
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&legacyMethods.has(node.expression.name.text))record(node,'methods',node.expression.name.text);
    ts.forEachChild(node,visit);
  }visit(source);if(locations.length)findings.push({file,locations});
}
const bridgePresent=fs.existsSync(path.join(sourceRoot,'postgres/compat.ts'));
const report={complete:!bridgePresent&&!findings.length,scannedFiles:scanned,scope:'All runtime TypeScript in apps/api/src; specs, comments and SQL parameter strings excluded.',bridgePresent,totals,filesRemaining:findings.length,findings};
const outputIndex=process.argv.indexOf('--output');if(outputIndex>=0)fs.writeFileSync(path.resolve(root,process.argv[outputIndex+1]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,findings:undefined},null,2));if(!report.complete)process.exitCode=1;
