/** Local QA proxy: preview frontend + isolated Phase6 backend only. No production .env. */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
const server=http.createServer((req,res)=>{const backend=req.url.startsWith('/api/')||req.url.startsWith('/media/'),target=new URL(req.url,backend?'https://localhost:57443':'http://127.0.0.1:56912');const request=(backend?https:http).request(target,{method:req.method,rejectUnauthorized:false,headers:{...req.headers,host:target.host,...(backend?{origin:'https://localhost:57443'}:{})}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});request.on('error',()=>{res.writeHead(502);res.end('QA upstream unavailable');});req.pipe(request);});server.listen(56913,'127.0.0.1',()=>console.log('Cropper QA proxy 56913 -> Next56912 / isolated staging57443'));

server.on('upgrade',(req,socket,head)=>{const upstream=net.connect(56912,'127.0.0.1',()=>{upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+req.rawHeaders.reduce((s,value,i)=>s+value+(i%2?'\r\n':': '),'')+'\r\n');if(head.length)upstream.write(head);socket.pipe(upstream).pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());});
