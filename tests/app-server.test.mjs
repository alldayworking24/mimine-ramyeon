import assert from 'node:assert/strict';
import {createAppServer} from '../app-server.mjs';
const calls=[];const server=createAppServer({proxy:async req=>{calls.push({auth:req.headers.get('Authorization'),body:await req.json()});return Response.json({ok:true});}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
try{
 const entry=await fetch(base+'/index.html');assert.equal(entry.status,200);const html=await entry.text();assert.match(html,/auth-view/);assert.ok(!html.includes('function createMiminePreviewProvider'));assert.match(html,/payment-banner/);
 const anon=await fetch(base+'/.netlify/functions/mimine-bank',{method:'POST'});assert.equal(anon.status,401);assert.equal(calls.length,0);
 const wrongOrigin=await fetch(base+'/.netlify/functions/mimine-bank',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer fixture'}});assert.equal(wrongOrigin.status,403);
 const ok=await fetch(base+'/.netlify/functions/mimine-bank',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action:'list'})});assert.equal(ok.status,200);assert.equal(calls[0].auth,'Bearer fixture');assert.equal(calls[0].body.action,'list');
 assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,403);
 assert.equal((await fetch(base+'/.env')).status,403);
 console.log('Local real-data server: current login entry, no anonymous bank proxy, same-origin guard, fixed authenticated proxy and path protection passed.');
}finally{await new Promise(resolve=>server.close(resolve));}
