/** Node HTTP/WebSocket development gateway. No Nginx installation required. */
import {createServer,request as proxyRequest} from 'node:http';
import {connect as connectTcp} from 'node:net';
const routes=[
[/^\/api\/(?:admin\/exams\/[^/]+\/pdf-ai)(?:\/|$)/,'ai-import'],
[/^\/api\/(?:admin\/pdf-ai|pdf-ai)(?:\/|$)/,'ai-import'],
[/^\/api\/(?:auth|admin\/auth|users|admin\/users)(?:\/|$)/,'identity'],
[/^\/api\/(?:admin\/media-library\/(?:dictation|vocab)|admin\/content-quality|words|admin\/words|collections|admin\/collections|lessons|admin\/lessons|vocabulary-groups|admin\/vocabulary-groups|dictation|admin\/dictation|upload)(?:\/|$)/,'content'],
[/^\/api\/(?:admin\/media-library\/toeic|exams|admin\/exams|exam-groups|admin\/exam-groups|admin\/questions|attempts|admin\/attempts)(?:\/|$)/,'assessment'],
[/^\/api\/(?:arena|admin\/arena)(?:\/|$)/,'arena'],
[/^\/api\/(?:admin\/media-library\/games|learning|learning-activity|progress|reviews|sessions|admin\/learning|admin\/dashboard|minigames|admin\/minigames|admin\/games)(?:\/|$)/,'learning'],
[/^\/api\/(?:site-settings|admin\/site-settings|admin\/audio|admin\/asr|admin\/infrastructure|tts|asr)(?:\/|$)/,'media-jobs'],
[/^\/api\/(?:activity-logs|admin\/activity-logs)(?:\/|$)/,'notification'],
];
const defaultPorts={'identity':5001,'content':5002,'assessment':5003,'arena':5004,'learning':5005,
  'media-jobs':5006,'ai-import':5007,'notification':5008};
function target(url){const path=url.split('?')[0];if(path.startsWith('/api/_internal/'))return null;
 if(path.startsWith('/socket.io/'))return 'arena';if(path.startsWith('/media/'))return 'media-jobs';
 return routes.find(([re])=>re.test(path))?.[1]??null;}
function error(res,status,msg){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({statusCode:status,message:msg}));}
const srv=createServer((req,res)=>{
 if(['/gateway/health','/api/health'].includes(req.url)){error(res,200,'development gateway ready');return;}
 const readyMatch=/^\/gateway\/(identity|content|assessment|arena|learning|media-jobs|ai-import|notification)-ready$/.exec(req.url||'');
 const oldHealth={'/gateway/identity-health':'identity','/gateway/notification-health':'notification'};
 const role=readyMatch?.[1]||oldHealth[req.url||'']||target(req.url||'/');if(!role)return error(res,404,'Not found');
 const p=defaultPorts[role];
 const upstreamPath=readyMatch?'/api/health/ready':oldHealth[req.url||'']?'/api/health':req.url;
 const upstream=proxyRequest({hostname:'127.0.0.1',port:p,path:upstreamPath,method:req.method,
    headers:{...req.headers,host:`127.0.0.1:${p}`}},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res)});
 upstream.on('error',e=>error(res,502,`Backend ${role} unavailable: ${e.message}`));req.pipe(upstream);
});
srv.on('upgrade',(req,socket,head)=>{if(!req.url?.startsWith('/socket.io/'))return socket.destroy();
 const upstream=connectTcp(defaultPorts.arena,'127.0.0.1',()=>{
   const headers=Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n');
   upstream.write(`${req.method||'GET'} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
   if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
 });upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
});
srv.listen(Number(process.env.GATEWAY_PORT||5000),'127.0.0.1',()=>console.log('[dev-gateway] http://localhost:5000'));
