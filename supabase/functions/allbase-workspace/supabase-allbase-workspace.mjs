import {workspaceProjects, nativeSessionFor} from './allbase-workspace-server.mjs';
import {proofKeyUrl, verifyWorkspaceProof} from './allbase-workspace-proof.mjs';
let cachedKeys, validUntil=0;
const codes = new Set(['SETUP_REQUIRED','ACCOUNT_NOT_FOUND','ACCOUNT_UNAVAILABLE','ACCOUNT_MISMATCH','ADDITIONAL_VERIFICATION']);
function json(data,status=200) {
  return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
async function keys(fetcher) {
  if (cachedKeys && validUntil > Date.now()) return cachedKeys;
  const response = await fetcher(proofKeyUrl,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('INVALID_PROOF');
  const text = await response.text();
  if (text.length > 4096) throw new Error('INVALID_PROOF');
  const value = JSON.parse(text);
  if (!Array.isArray(value.keys) || value.keys.length !== 1) throw new Error('INVALID_PROOF');
  cachedKeys=value;validUntil=Date.now()+60000;
  return value;
}
function envKey(env,modern,legacy) {
  try {const value=JSON.parse(env(modern)||'{}').default;if(typeof value==='string'&&value.length>30)return value;} catch {}
  return env(legacy)||'';
}
export async function handleWorkspaceRequest(request,{app,env,fetcher=fetch,getKeys}={}) {
  const project=workspaceProjects[app];
  if (!project || env('SUPABASE_URL')?.replace(/\/$/,'') !== project.url) return json({error:'SETUP_REQUIRED'},503);
  if (request.method !== 'POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  if (request.headers.has('origin') || !request.headers.get('content-type')?.startsWith('application/json')) return json({error:'INVALID_PROOF'},403);
  if (Number(request.headers.get('content-length')||0)>256 || (await request.text()).length>256) return json({error:'INVALID_PROOF'},413);
  let user;
  try {
    const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    user=await verifyWorkspaceProof(token,project.url+'/functions/v1/allbase-workspace',getKeys||(()=>keys(fetcher)));
  } catch {return json({error:'INVALID_PROOF'},401);}
  try {
    const secret=envKey(env,'SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
    const publicKey=envKey(env,'SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY')||project.key;
    const session=await nativeSessionFor({...project,key:publicKey},user.email,()=>secret,fetcher);
    return json({session});
  } catch(error) {return json({error:codes.has(error?.code)?error.code:'APP_AUTH_UNAVAILABLE'},422);}
}
