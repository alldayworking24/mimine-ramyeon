// Shared, dependency-free verifier. The issuer/key URL is fixed by server code.
export const proofIssuer = 'https://alldaystudy.netlify.app';
export const proofKeyUrl = proofIssuer + '/api/allbase/workspace/keys';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = () => {throw new Error('INVALID_PROOF');};
function bytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) invalid();
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
}
export async function verifyWorkspaceProof(token, audience, getKeys, now=Math.floor(Date.now()/1000)) {
  try {
    if (typeof token !== 'string' || token.length > 3000) invalid();
    const parts = token.split('.');
    if (parts.length !== 3) invalid();
    const header = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(bytes(parts[1])));
    if (header.alg !== 'EdDSA' || header.typ !== 'JWT' || typeof header.kid !== 'string' || header.kid.length > 64) invalid();
    if (claims.iss !== proofIssuer || claims.aud !== audience || claims.purpose !== 'allbase:workspace:v1' || !uuid.test(claims.sub || '') || !uuid.test(claims.jti || '')) invalid();
    if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > now+5 || claims.iat < now-60 || claims.exp <= now || claims.exp-claims.iat !== 45) invalid();
    if (typeof claims.email !== 'string' || claims.email !== claims.email.trim().toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) invalid();
    const set = await getKeys();
    const matches = set?.keys?.filter(key=>key.kid === header.kid && key.kty === 'OKP' && key.crv === 'Ed25519' && key.alg === 'EdDSA' && !key.d);
    if (matches?.length !== 1) invalid();
    const key = await crypto.subtle.importKey('jwk',matches[0],{name:'Ed25519'},false,['verify']);
    if (!await crypto.subtle.verify('Ed25519',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) invalid();
    return {id:claims.sub,email:claims.email};
  } catch {invalid();}
}
