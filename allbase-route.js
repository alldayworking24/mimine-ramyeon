(()=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validLaunchDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=Date.parse(value+'T12:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
function normalizeLaunchDetails(app,values={}){
  if(!['adw','study'].includes(app))return {};
  const details={},record=values?.record,date=values?.date;
  if(typeof record==='string'&&record.length>0&&record.length<=512&&!/[\u0000-\u001f\u007f]/.test(record)&&!['undefined','null'].includes(record)&&(app!=='adw'||uuid.test(record)))details.record=record;
  if(validLaunchDate(date))details.date=date;
  return details;
}
function launchHash(app,target,values={}){
  const details=normalizeLaunchDetails(app,values),params=new URLSearchParams();
  if(app==='study'){
    if(details.date)params.set('date',details.date);
    if(details.record)params.set('event',details.record);
    if(details.date||details.record)params.set('mode','today');
    return '/#'+encodeURIComponent(target)+(params.size?'?'+params:'');
  }
  params.set('allbase',target);
  for(const [key,value]of Object.entries(details))params.set(key,value);
  return '/#'+params;
}

  const app="mimine",params=new URLSearchParams(location.hash.slice(1)),target=params.get('allbase');
  const valid=app==='mimine'?['sales','expenses','dashboard','products','all']:['dashboard','quotes','jobs','sales','calendar','customers','sites','expenses'];
  if(!valid.includes(target))return;
  const details=normalizeLaunchDetails(app,{record:params.get('record'),date:params.get('date')});
  let attempts=0;
  function consumed(){clearInterval(timer);history.replaceState(history.state,'',location.pathname+location.search);}
  async function openWork(){
    try{
      const rows=await api('work_orders?id=eq.'+encodeURIComponent(details.record)+'&select=*&limit=1');
      if(!rows?.[0]||String(rows[0].id)!==details.record)throw new Error('WORK_NOT_FOUND');
      await showDetailPage('jobs',rows[0]);
    }catch{
      openPage('jobs');
      alert('선택한 작업을 찾을 수 없거나 조회 권한이 없습니다. 작업 목록에서 확인해 주세요.');
    }
  }
  const timer=setInterval(()=>{
    if(++attempts>120){clearInterval(timer);return;}
    if(app==='mimine'){
      const root=document.getElementById('appView');
      if(!root||root.classList.contains('hidden')||typeof navigateToPanel!=='function')return;
      consumed();navigateToPanel(target);return;
    }
    const login=document.getElementById('loginBg');
    if(login?.classList.contains('open'))return;
    if(target==='jobs'&&details.record){
      if(typeof api!=='function'||typeof showDetailPage!=='function'||typeof openPage!=='function')return;
      consumed();void openWork();return;
    }
    const button=document.querySelector('button[data-page="'+target+'"]');
    if(!button&&typeof openPage!=='function')return;
    consumed();if(button)button.click();else openPage(target);
  },250);
})();
