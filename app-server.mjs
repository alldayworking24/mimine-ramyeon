import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import bankProxy from './netlify/functions/mimine-bank.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.gz':'application/gzip','.wasm':'application/wasm','.webmanifest':'application/manifest+json'};
export function createAppServer({root=path.join(base,'dist'),proxy=bankProxy}={}){
 return http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  const reply=(status,text,type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(text);};
  try{
   const host=req.headers.host||'',url=new URL(req.url,'http://'+host);
   if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return reply(403,'Localhost access only.');
   if(url.pathname==='/.netlify/functions/mimine-bank'){
    if(req.method!=='POST')return reply(405,'POST required.');
    if(req.headers.origin&&req.headers.origin!=='http://'+host)return reply(403,'Same-origin request required.');
    if(!/^Bearer \S+$/.test(req.headers.authorization||''))return reply(401,JSON.stringify({error:'로그인이 필요합니다.'}),'application/json');
    let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>16384)return reply(413,'Request too large.');chunks.push(chunk);}
    const result=await proxy(new Request('http://'+host+url.pathname,{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:Buffer.concat(chunks)}));
    const body=Buffer.from(await result.arrayBuffer());res.writeHead(result.status,{...headers,'Content-Type':'application/json'});res.end(body);return;
   }
   if(!['GET','HEAD'].includes(req.method))return reply(405,'GET required.');
   const requested=decodeURIComponent(url.pathname),candidate=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));
   if(!candidate.startsWith(path.resolve(root)+path.sep)||requested.split('/').some(p=>p.startsWith('.')))return reply(403,'Forbidden.');
   const target=await realpath(candidate),rootReal=await realpath(root);
   if(!target.startsWith(rootReal+path.sep)||(await stat(target)).isFile()===false)return reply(403,'Forbidden.');
   const data=await readFile(target);res.writeHead(200,{...headers,'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){reply(error.code==='ENOENT'?404:400,error.code==='ENOENT'?'Not found.':'Unable to serve request.');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(Number(process.versions.node.split('.')[0])<22){console.error('Node.js 22 or later is required.');process.exit(1);}
 const port=Number(process.env.MIMINE_PORT||4173);
 createAppServer().listen(port,'127.0.0.1',()=>console.log('Mimine real-data mode: http://localhost:'+port+'/index.html\nLog in with your existing Mimine account. Demo files are separate. Keep this window open.'));
}
