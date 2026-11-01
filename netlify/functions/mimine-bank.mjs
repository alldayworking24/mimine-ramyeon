export default async function(req){
 const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 if(req.method!=='POST')return Response.json({error:'POST 요청만 허용됩니다.'},{status:405,headers});
 const auth=req.headers.get('Authorization')||'';
 if(!/^Bearer \S+$/.test(auth))return Response.json({error:'로그인이 필요합니다.'},{status:401,headers});
 try{const body=await req.text();if(new TextEncoder().encode(body).length>16384)return Response.json({error:'요청이 너무 큽니다.'},{status:413,headers});
 const r=await fetch('https://hdhkmmngawthbsnconvq.supabase.co/functions/v1/mimine-bank',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(25000),redirect:'error'});
 return new Response(r.body,{status:r.status,headers});
 }catch{return Response.json({error:'통장 연결 서버에 접속하지 못했습니다. 다시 시도해 주세요.'},{status:503,headers})}
}
