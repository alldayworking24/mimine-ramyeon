/* Login lives in the new root page; credentials and permissions are unchanged. */
// Android file managers open HTML through content://, without access to sibling
// assets or the hosted bank proxy. Only web origins may start real login.
function isMimineLocalDocument(){return !['http:','https:'].includes(location.protocol);}
function loadMimineSdk(){
 if(window.supabase?.createClient)return Promise.resolve(window.supabase);
 return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='flow/vendor/auth/supabase.js';script.onload=()=>resolve(window.supabase);script.onerror=()=>reject(new Error('로그인 모듈을 불러오지 못했습니다. 파일을 모두 배치했는지 확인해 주세요.'));document.head.append(script);});
}
async function createMimineAuthenticatedBridge(){
 if(isMimineLocalDocument())return createMiminePreviewProvider();
 const form=document.getElementById('auth-form'),message=document.getElementById('auth-message'),button=document.getElementById('auth-submit');
 const preview=document.getElementById('auth-preview');
 preview.onclick=()=>{const url=new URL(location.href);url.searchParams.set('preview','1');location.assign(url.href);};
 const recovery=new URLSearchParams(location.search).has('code')||location.hash.includes('type=recovery');
 if(recovery){const url=new URL('legacy/index.html',location.href);url.search=location.search;url.hash=location.hash;location.replace(url.href);return new Promise(()=>{});}
 let sdk;try{sdk=await loadMimineSdk();}catch(error){message.textContent=error.message;button.disabled=true;return new Promise(()=>{});}
 const client=sdk.createClient('https://hunoualsfmfckalwbilt.supabase.co','sb_publishable_DFp-SNqkUWJiX4CHLu_gxQ_FrtXHDwg');
 return new Promise(resolve=>{
  let opened=false,checking=false;
  async function open(session){
   if(opened||checking||!session)return;
   checking=true;button.disabled=true;message.textContent='사용 권한을 확인하고 있어요.';
   try{
    const{data,error}=await client.from('app_users').select('is_active').eq('user_id',session.user.id).maybeSingle();
    if(error)throw error;if(!data?.is_active)throw new Error('사용 승인이 필요한 계정입니다. 기존 계정 상태를 확인해 주세요.');
    opened=true;message.textContent='매장 데이터를 불러오고 있어요.';
    resolve(createMimineProductionBridge(client));
   }catch(error){message.textContent=error.message||'사용 권한을 확인하지 못했습니다.';}
   finally{checking=false;if(!opened)button.disabled=false;}
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(checking||opened)return;button.disabled=true;message.textContent='로그인하고 있어요.';
   try{const{data,error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(error)throw error;await open(data.session);}
   catch(error){message.textContent=error.message||'로그인하지 못했습니다.';}
   finally{if(!opened)button.disabled=false;}
  });
  client.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'&&opened){location.replace(new URL('index.html',location.href).href);return;}
   if(event==='SIGNED_IN'&&session)setTimeout(()=>void open(session),0);
  });
  client.auth.getSession().then(({data,error})=>{if(error)message.textContent=error.message;else if(data.session)void open(data.session);else message.textContent='기존 미미네 계정으로 로그인해 주세요.';}).catch(error=>message.textContent=error.message);
 });
}
