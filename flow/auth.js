/* Login lives in the new root page; credentials and permissions are unchanged. */
// File/content documents show the login gate; only web origins may start login.
function isMimineLocalDocument(){return !['http:','https:'].includes(location.protocol);}
function loadMimineSdk(){
 if(window.supabase?.createClient)return Promise.resolve(window.supabase);
 return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='flow/vendor/auth/supabase.js';script.onload=()=>resolve(window.supabase);script.onerror=()=>reject(new Error('로그인 모듈을 불러오지 못했습니다. 파일을 모두 배치했는지 확인해 주세요.'));document.head.append(script);});
}
async function createMimineAuthenticatedBridge(){
 const form=document.getElementById('auth-form'),message=document.getElementById('auth-message'),button=document.getElementById('auth-submit');
 if(isMimineLocalDocument()){
  form.hidden=true;document.getElementById('auth-account').hidden=true;
  document.getElementById('auth-online').hidden=false;
  message.textContent='파일로 직접 연 화면입니다. 수정본의 실데이터는 PC에서 동봉한 실행 파일로 서버를 실행한 뒤 로그인해야 표시됩니다. 운영 사이트 링크는 현재 배포본이며, 실행 방법은 START-HERE.txt를 확인하세요.';
  return new Promise(()=>{});
 }
 const recovery=new URLSearchParams(location.search).has('code')||location.hash.includes('type=recovery');
 if(recovery){const url=new URL('legacy/index.html',location.href);url.search=location.search;url.hash=location.hash;location.replace(url.href);return new Promise(()=>{});}
 let sdk;try{sdk=await loadMimineSdk();}catch(error){message.textContent=error.message;button.disabled=true;return new Promise(()=>{});}
 const client=sdk.createClient('https://hunoualsfmfckalwbilt.supabase.co','sb_publishable_DFp-SNqkUWJiX4CHLu_gxQ_FrtXHDwg');
 return new Promise(resolve=>{
  let opened=false,checking=false,activeUserId='',revision=0;
  function lock(){
   document.body.classList.add('auth-loading');
   document.getElementById('main').replaceChildren();
   document.getElementById('modal-root').replaceChildren();
   location.replace(new URL('index.html',location.href).href);
  }
  async function open(session){
   if(opened||checking||!session)return;
   const startedRevision=revision;
   checking=true;button.disabled=true;message.textContent='사용 권한을 확인하고 있어요.';
   try{
    const verified=await client.auth.getUser();
    if(verified.error)throw verified.error;
    const user=verified.data?.user;
    if(!user?.id||user.id!==session.user?.id||user.is_anonymous)throw new Error('유효한 계정으로 다시 로그인해 주세요.');
    const{data,error}=await client.from('app_users').select('is_active').eq('user_id',user.id).maybeSingle();
    if(error)throw error;if(!data?.is_active)throw new Error('사용 승인이 필요한 계정입니다. 기존 계정 상태를 확인해 주세요.');
    if(startedRevision!==revision)return;
    opened=true;activeUserId=user.id;message.textContent='매장 데이터를 불러오고 있어요.';
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
   if(event==='SIGNED_OUT')revision++;
   if(opened&&(event==='SIGNED_OUT'||(event==='SIGNED_IN'&&session?.user?.id!==activeUserId))){lock();return;}
   if(event==='SIGNED_IN'&&session)setTimeout(()=>void open(session),0);
  });
  client.auth.getSession().then(({data,error})=>{if(error)message.textContent=error.message;else if(data.session)void open(data.session);else message.textContent='기존 미미네 계정으로 로그인해 주세요.';}).catch(error=>message.textContent=error.message);
 });
}
