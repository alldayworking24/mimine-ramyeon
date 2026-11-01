// Server only. Copy to the study app's lib/ directory; never publish this module in dist/.
// The caller must supply an active, email-confirmed Identity user from admin.getUser().
export const workspaceProjects = Object.freeze({
  mimine: {url:'https://hunoualsfmfckalwbilt.supabase.co', key:'sb_publishable_DFp-SNqkUWJiX4CHLu_gxQ_FrtXHDwg', secret:'ALLBASE_MIMINE_SECRET_KEY', legacySecret:'ALLBASE_MIMINE_SERVICE_ROLE_KEY'},
  adw: {url:'https://hdhkmmngawthbsnconvq.supabase.co', key:'sb_publishable_qA3wBeHX9NvQWmgtufL3mg_JMeeqtw5', secret:'ALLBASE_ADW_SECRET_KEY', legacySecret:'ALLBASE_ADW_SERVICE_ROLE_KEY'}
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const fail = code => {throw Object.assign(new Error(code), {code});};
function activeAccount(user, email) {
  if (!uuid.test(user?.id || '') || emailOf(user.email) !== email) fail('ACCOUNT_MISMATCH');
  if (!user.email_confirmed_at || user.is_anonymous || user.deleted_at || Date.parse(user.banned_until || '') > Date.now()) fail('ACCOUNT_UNAVAILABLE');
  // Do not replace an account's required second factor with a lower-assurance login.
  if (user.is_sso_user || user.factors?.some(factor => factor.status === 'verified')) fail('ADDITIONAL_VERIFICATION');
  return user;
}
async function request(project, path, credential, body, fetcher, accessToken) {
  // Opaque sb_publishable_/sb_secret_ keys belong only in apikey. Only actual
  // user JWTs (or legacy JWT service keys) belong in Authorization: Bearer.
  const authorization = accessToken || (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential) ? credential : null);
  const response = await fetcher(project.url + '/auth/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {apikey:credential, ...(authorization ? {Authorization:'Bearer ' + authorization} : {}), ...(body ? {'Content-Type':'application/json'} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
    cache:'no-store', redirect:'error', signal:AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) fail('APP_AUTH_UNAVAILABLE');
  return data;
}
export async function nativeSessionFor(project, email, env, fetcher=fetch) {
  const secret = env(project.secret) || env(project.legacySecret);
  if (typeof secret !== 'string' || secret.length < 30) fail('SETUP_REQUIRED');
  let match;
  // listUsers pagination is server-side only. Never expose the directory or accept
  // a client-selected email/user ID, and never create or invite a missing account.
  for (let page=1; page<=20; page++) {
    const result = await request(project, 'admin/users?' + new URLSearchParams({page:String(page), per_page:'1000'}), secret, null, fetcher);
    if (!Array.isArray(result.users)) fail('APP_AUTH_UNAVAILABLE');
    for (const user of result.users) if (emailOf(user.email) === email) {
      if (match) fail('ACCOUNT_MISMATCH');
      match = activeAccount(user, email);
    }
    if (result.users.length < 1000) break;
    if (page === 20) fail('APP_AUTH_UNAVAILABLE');
  }
  if (!match) fail('ACCOUNT_NOT_FOUND');
  const current = await request(project, 'admin/users/' + match.id, secret, null, fetcher);
  activeAccount(current, email);
  if (current.id !== match.id) fail('ACCOUNT_MISMATCH');
  const link = await request(project, 'admin/generate_link', secret, {type:'magiclink', email}, fetcher);
  // GoTrue's REST response is flat; its JS SDK separates user and properties.
  const generated = link.user || link;
  if (generated.id !== current.id || emailOf(generated.email) !== email) fail('ACCOUNT_MISMATCH');
  const hash = link.properties?.hashed_token || link.hashed_token;
  if (typeof hash !== 'string' || hash.length < 16) fail('APP_AUTH_UNAVAILABLE');
  // Generate/consume internally. No email is sent and no OTP/link leaves this server.
  const result = await request(project, 'verify', project.key, {token_hash:hash, type:'email'}, fetcher);
  if (result.user?.id !== current.id || !result.access_token || !result.refresh_token) fail('ACCOUNT_MISMATCH');
  const verified = await request(project, 'user', project.key, null, fetcher, result.access_token);
  activeAccount(verified, email);
  if (verified.id !== current.id) fail('ACCOUNT_MISMATCH');
  return {access_token:result.access_token, refresh_token:result.refresh_token,
    expires_at:Number(result.expires_at) || Math.floor(Date.now()/1000) + Number(result.expires_in || 3600),
    user:{id:verified.id, email:emailOf(verified.email)}};
}
export async function workspaceSessions(user, {env, fetcher=fetch, signer} = {}) {
  const email = emailOf(user?.email);
  if (!uuid.test(user?.id || '') || !user.confirmed || !user.active || user.deletedAt || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('ACCOUNT_UNAVAILABLE');
  const sessions = {}, errors = {};
  await Promise.all(Object.entries(workspaceProjects).map(async ([id, project]) => {
    try {
      if (!signer) {sessions[id] = await nativeSessionFor(project, email, env, fetcher);return;}
      const audience=project.url+'/functions/v1/allbase-workspace';
      const response=await fetcher(audience,{method:'POST',headers:{apikey:project.key,Authorization:'Bearer '+await signer(user,audience),'Content-Type':'application/json'},body:'{}',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000)});
      const data=await response.json().catch(()=>null);
      if (!response.ok) fail(data?.error || 'APP_AUTH_UNAVAILABLE');
      const session=data?.session;
      if (!uuid.test(session?.user?.id||'') || emailOf(session?.user?.email)!==email || typeof session.access_token!=='string' || !session.access_token || typeof session.refresh_token!=='string' || !session.refresh_token || !Number.isFinite(session.expires_at) || session.expires_at<=Date.now()/1000) fail('ACCOUNT_MISMATCH');
      sessions[id]={access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,user:{id:session.user.id,email}};
    }
    catch (error) {errors[id] = ['SETUP_REQUIRED','ACCOUNT_NOT_FOUND','ACCOUNT_UNAVAILABLE','ACCOUNT_MISMATCH','ADDITIONAL_VERIFICATION'].includes(error?.code) ? error.code : 'APP_AUTH_UNAVAILABLE';}
  }));
  return {sessions, errors};
}
