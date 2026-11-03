import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.join(process.cwd(),'dist'),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.gz':'application/gzip','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
 });
});
server.listen(port,'0.0.0.0',()=>console.log(`Local preview ready: http://terminal.local:${port}/preview/index.html\nOn your computer: http://localhost:${port}/preview/index.html`));
