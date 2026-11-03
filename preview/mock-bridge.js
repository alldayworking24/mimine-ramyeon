const log=text=>document.querySelector('#log').textContent=text;
window.MimineBridge=createMiminePreviewProvider({onLog:log});
const frame=document.querySelector('#app-frame');frame.src='../index.html';
document.querySelector('#size').onchange=e=>frame.style.width=e.target.value+'px';
document.querySelector('#failure').onclick=()=>{window.MimineBridge.failNextSave?.();log('다음 저장 실패 체험은 미리보기에서만 동작합니다.');};
document.querySelector('#incoming').onclick=()=>{window.MimineBridge.receiveSample?.();frame.contentWindow.MimineFlowRefresh?.();};
