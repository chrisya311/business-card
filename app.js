/* 名片管家：按鈕接線、設定畫面、啟動（一定要最後載入） */
'use strict';
/* ---------- events ---------- */
document.addEventListener('change',e=>{if(e.target.closest('#eForm .checks'))paintChecks()});
document.addEventListener('click',async e=>{
  const t=e.target;
  const close=t.closest('[data-close]');if(close){if(scanCtl)scanCtl.abort();const m=close.closest('.modal');
    if(m.id==='mBatch'&&B.rows.some(r=>r.state==='ok')&&!await confirmBox('還有辨識好、但還沒儲存的名片，確定要關掉嗎？\n（關掉後這些辨識結果會清掉）',{ok:'關掉',danger:true}))return;
    if(m.id==='mBatch'){if(B.ctl)B.ctl.abort();B.rows=[]}
    closeModal(m);return}
  const it=t.closest('.item');if(it){if(it.dataset.id)select(it.dataset.id);return}
  const go=t.closest('[data-go]');if(go){select(go.dataset.go);return}
  if(t.closest('[data-scan]')){openScan();return}
  const chip=t.closest('[data-cat]');if(chip){if(chipDragged)return;S.cat=chip.dataset.cat;renderList();centerChip($('#catChips'));return}
  const insb=t.closest('[data-ins]');if(insb&&insb.closest('#insRow')){if(chipDragged)return;S.ins=S.ins===insb.dataset.ins?'':insb.dataset.ins;renderList();centerChip($('#insRow'));return}
  const bn=t.closest('.banner button[data-f]');if(bn){if(bn.dataset.f==='all'){S.follow='all';S.cat='';S.region='';S.proc='';S.q='';$('#q').value=''}else S.follow=S.follow===bn.dataset.f?'all':bn.dataset.f;renderList();return}
  const zi=t.closest('[data-zoom]');if(zi&&zi.src){$('#zoom img').src=zi.src;$('#zoom').classList.add('on');return}
  if(t.closest('#zoom')){$('#zoom').classList.remove('on');return}

  // photo slots
  const pick=t.closest('[data-pick]');if(pick){const slot=pick.closest('.pslot');pickCtx={target:slot.closest('#scanSlots')?'scan':'edit',side:slot.dataset.side};const inp=$('#photoInput');inp.value='';inp.click();return}
  const clr=t.closest('[data-clear]');if(clr){const slot=clr.closest('.pslot');const target=slot.closest('#scanSlots')?'scan':'edit';slotState[target][slot.dataset.side]='';slotOrig[target][slot.dataset.side]=null;paintSlots(target);return}
  const rtb=t.closest('[data-rot]');if(rtb){const slot=rtb.closest('.pslot');rtb.disabled=true;rotateSlot(slot.closest('#scanSlots')?'scan':'edit',slot.dataset.side,1).finally(()=>{rtb.disabled=false});return}
  const crp=t.closest('[data-crop]');if(crp){const slot=crp.closest('.pslot');openCrop(slot.closest('#scanSlots')?'scan':'edit',slot.dataset.side);return}

  const c=contacts.find(x=>x.id===S.sel);
  if(t.closest('#dBack')){goBack();return}
  if(!c)return;
  if(t.closest('#dEdit')){openEdit(c);return}
  if(t.closest('#pNew')){openEdit(normalize({company:c.company,taxId:c.taxId,companyId:c.id,category:c.category}));return}
  if(t.closest('#dDel')&&isCo(c)){const ppl=peopleOf(c);if(await confirmBox(`確定要刪除「${c.company}」？\n\n會一起刪除 ${c.visits.length} 筆拜訪紀錄${ppl.length?`和 ${ppl.length} 位聯絡人（${ppl.slice(0,3).map(p=>p.name).join('、')}${ppl.length>3?'…':''}）的名片`:''}，無法復原。`,{ok:'全部刪除',danger:true})){try{for(const p of ppl)await Store.del(p);await Store.del(c);const gone=new Set([c.id,...ppl.map(p=>p.id)]);contacts=contacts.filter(x=>!gone.has(x.id));S.sel=null;refresh();if(history.state&&history.state.detail)history.back();toast('已刪除')}catch(_){toast('刪除失敗')}}return}
  if(t.closest('#dDel')){if(await confirmBox(coOf(c)?`確定要刪除「${c.name}」的名片？\n（公司的拜訪紀錄會留著）`:`確定要刪除「${c.name}」？\n（包含照片和所有拜訪紀錄，無法復原）`,{ok:'刪除',danger:true})){try{await Store.del(c);contacts=contacts.filter(x=>x.id!==c.id);S.sel=null;refresh();if(history.state&&history.state.detail)history.back();toast('已刪除')}catch(_){toast('刪除失敗')}}return}
  if(t.closest('#dAsk')){
    const P0=isCo(c)?sortPeople(c)[0]:c;const C0=isCo(c)?c:(coOf(c)||c);const lv=isCo(C0)?lastVisit(C0):(personVisits(c).sort(byDate)[0]||{}).v;
    const txt=`幫我做拜訪前準備，請上網查這家公司，整理成一頁重點（公司做什麼產品、規模、主要客戶產業、可能用到哪些刀具或加工、最近新聞，以及我拜訪時可以聊的切入點）：\n\n公司：${C0.company||'（未填）'}\n地址：${C0.address||c.address||'（未填）'}\n網站：${C0.website||'（未填）'}\n對象：${isCo(c)?sortPeople(c).map(p=>p.name+(p.title?'（'+p.title+'）':'')).join('、')||'（未填）':c.name+(c.title?'（'+c.title+'）':'')}\n已知加工類型：${C0.processes.join('、')||'不清楚'}\n目前使用的刀具品牌：${C0.brands||'不清楚'}\n備註：${C0.notes||(P0&&P0.notes)||'無'}${lv?`\n上次聯絡（${fmtD(lv.date)}）：${lv.content}${lv.next?'；下一步：'+lv.next:''}`:''}`;
    try{await navigator.clipboard.writeText(txt);toast('已複製，貼給 Claude 就可以')}catch(_){await infoBox('請長按下面的文字全選後複製，再貼給 Claude：',{text:txt,ok:'關閉'})}
    return}
  if(t.closest('#fDone')){c.nextFollow='';await save(c).catch(()=>toast('儲存失敗'));refresh();toast('已清除跟進日期，記得記一筆紀錄');openVisit(c,null,{ins:!isCo(c)&&!!coOf(c)});return}
  const rn=t.closest('[data-renew]');if(rn){const i=+rn.dataset.renew;const x=(c.cars||[])[i];if(!x||!x.exp)return;
    const d=new Date(x.exp+'T00:00:00');d.setFullYear(d.getFullYear()+1);const exp=ymd(d);
    if(!await confirmBox(`${x.plate||'這台車'} 已經續保了嗎？\n\n保險到期日會從 ${fmtD(x.exp)} 改成 ${fmtD(exp)}。`,{ok:'已續保'}))return;
    const nc={...c,cars:c.cars.map((y,j)=>j===i?{...y,exp}:y)};await save(nc).catch(()=>toast('儲存失敗'));refresh();toast(`保險到期日改為 ${fmtD(exp)}`);return}
  const sn=t.closest('[data-snooze]');if(sn){const base=c.nextFollow&&c.nextFollow>today()?c.nextFollow:today();c.nextFollow=addDays(base,+sn.dataset.snooze);await save(c).catch(()=>toast('儲存失敗'));refresh();toast('跟進日期改為 '+fmtD(c.nextFollow));return}
  if(t.closest('#vNewIns')){openVisit(c,null,{ins:true});return}
  if(t.closest('#vNew')){const co=coOf(c);if(!isCo(c)&&co)openVisit(co,null,{who:[c.id]});else openVisit(c);return}
  const own=el=>{const o=el.closest('[data-o]');return (o&&contacts.find(x=>x.id===o.dataset.o))||c};
  const veb=t.closest('[data-vedit-btn]');if(veb){openVisit(own(veb),veb.dataset.veditBtn);return}
  if(t.closest('[data-padd]')){pickVisitPhotos(null);return}
  const pd=t.closest('[data-pdel]');if(pd){vPend.splice(+pd.dataset.pdel,1);paintPend();saveDraft();return}
  const pxd=t.closest('[data-pxdel]');if(pxd){VS.removed.push(pxd.dataset.pxdel);paintPend();saveDraft();return}
  const va=t.closest('[data-vpadd]');if(va){pickVisitPhotos(va.dataset.vpadd,own(va).id);return}
  const vpd=t.closest('[data-vpdel]');if(vpd){if(await confirmBox('刪除這張照片？',{ok:'刪除',danger:true})){const pid=vpd.dataset.vpdel;const c=own(vpd);
    const nc={...c,visits:c.visits.map(x=>x.id===vpd.dataset.v?{...x,photos:(x.photos||[]).filter(p=>p.id!==pid)}:x),deletedPhotos:[...(c.deletedPhotos||[]),pid]};
    await VP.del(pid);await save(nc).catch(()=>toast('刪除失敗'));renderDetail()}return}
  const ve=t.closest('[data-vedit]');if(ve&&!t.closest('button,a,img,.vph')){openVisit(own(ve),ve.dataset.vedit);return}
  const vd=t.closest('[data-vdel]');if(vd){if(await confirmBox('刪除這筆紀錄？',{ok:'刪除',danger:true})){const c=own(vd);const gone=c.visits.find(v=>v.id===vd.dataset.vdel);for(const ph of (gone&&gone.photos)||[])await VP.del(ph.id);const nc={...c,visits:c.visits.filter(v=>v.id!==vd.dataset.vdel),deletedVisits:[...(c.deletedVisits||[]),vd.dataset.vdel]};await save(nc).catch(()=>toast('刪除失敗'));refresh()}return}
});
document.addEventListener('click',async e=>{
  const x=e.target.closest('[data-x]');if(x){const list=scopeList();if(!list.length){toast('沒有可匯出的名片');return}
    const ok=await ({xlsx:exportXLSX,outlook:exportOutlook,json:exportJSON})[x.dataset.x](list);if(ok){toast('已匯出');closeModal($('#mExport'))}return}
  const im=e.target.closest('[data-i]');if(im){const inp=$('#importInput');inp.dataset.kind=im.dataset.i;inp.accept=im.dataset.i==='json'?'.json,application/json':'.csv,text/csv';inp.value='';inp.click()}
});
$('#bScan').onclick=()=>openScan();
/* 類別那一排（電腦）：點了之後捲到中間；滑鼠滾輪改成左右捲；也可以按住左右拖 */
function centerChip(box){const on=box&&box.querySelector('.chip.on');if(on)box.scrollTo({left:on.offsetLeft-(box.clientWidth-on.offsetWidth)/2,behavior:'smooth'})}
let chipDragged=false;
for(const box of [$('#catChips'),$('#insRow')]){
  box.addEventListener('wheel',e=>{if(box.scrollWidth<=box.clientWidth||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;e.preventDefault();box.scrollLeft+=e.deltaY},{passive:false});
  let x0=0,s0=0,down=false;
  box.addEventListener('mousedown',e=>{if(e.button!==0)return;down=true;chipDragged=false;x0=e.clientX;s0=box.scrollLeft});
  addEventListener('mousemove',e=>{if(!down)return;const dx=e.clientX-x0;if(Math.abs(dx)>5){chipDragged=true;box.classList.add('dragging')}if(chipDragged)box.scrollLeft=s0-dx});
  addEventListener('mouseup',()=>{if(!down)return;down=false;box.classList.remove('dragging');setTimeout(()=>{chipDragged=false},0)})}
$('#bCal').onclick=()=>openCal();
$('#eMerge').onclick=()=>openMerge();
$('#mgList').addEventListener('click',async e=>{const b=e.target.closest('[data-mg]');if(!b)return;const to=contacts.find(x=>x.id===b.dataset.mg);const from=contacts.find(x=>x.id===editing.id);if(!to||!from)return;
  if(!await confirmBox(`把「${from.company}」合併到「${to.company}」？\n\n${peopleOf(from).length} 位聯絡人和 ${from.visits.length} 筆拜訪紀錄會搬過去，「${from.company}」會變成「${to.company}」的其他名稱。`,{ok:'合併'}))return;
  try{const t=await mergeCo(from,to);closeModal($('#mMerge'),true);closeModal($('#mEdit'),true);
    S.sel=t.id;if(isNarrow())history.replaceState({detail:t.id},'');refresh();toast(`已合併到「${t.company}」`)}catch(_){toast('合併失敗')}});
hydrateIcons();Theme.set(Theme.get());
$('#bTheme').onclick=()=>Theme.set(Theme.get()==='dark'?'light':'dark');
$('#syncBadge').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#syncBadge').click()}});
$('#bExport').onclick=()=>openModal('#mExport');
$('#bImport').onclick=()=>openModal('#mImport');
$('#scanGo').onclick=runScan;
$('#bBatch').onclick=()=>{openBatch();if(!B.rows.length&&$('#mBatch').classList.contains('on')){const i=$('#batchInput');i.value='';i.click()}};
$('#bAddMore').onclick=()=>{const i=$('#batchInput');i.value='';i.click()};
$('#batchInput').onchange=e=>{if(e.target.files.length)addBatchFiles(e.target.files)};
$('#bStop').onclick=()=>{if(B.ctl)B.ctl.abort()};
$('#bSave').onclick=saveBatch;
$('#bAll').onchange=e=>{B.rows.forEach(r=>{if(r.state==='ok')r.on=e.target.checked});renderBatch()};
$('#bBody').addEventListener('input',e=>{const k=e.target.dataset.bk;if(!k)return;const r=B.rows.find(x=>x.id===e.target.closest('tr').dataset.r);if(r&&r.pre){r.pre[k]=e.target.value;e.target.classList.remove('warn');if(k==='address'&&!r.pre.region)r.pre.region=findRegion(r.pre.address)||''}});
$('#bBody').addEventListener('click',e=>{const tr=e.target.closest('tr');if(!tr)return;const r=B.rows.find(x=>x.id===tr.dataset.r);if(!r)return;
  if(e.target.closest('[data-bon]')){r.on=e.target.checked;tr.classList.toggle('off',!r.on);updateBatchBar();return}
  if(e.target.closest('[data-bdel]')){if(r.state==='run')return;B.rows=B.rows.filter(x=>x!==r);renderBatch();return}
  if(e.target.closest('[data-bretry]')){r.state='wait';r.err='';renderBatch();runBatch()}});
/* drag & drop (computer) */
let dragDepth=0;
const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
document.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth++;if(!$('#mEdit').classList.contains('on')&&!$('#mScan').classList.contains('on'))$('#drop').classList.add('on')});
document.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
document.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drop').classList.remove('on')});
document.addEventListener('drop',async e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth=0;$('#drop').classList.remove('on');
  const files=[...e.dataTransfer.files];if(!files.length)return;
  const slot=e.target.closest&&e.target.closest('.pslot');
  if(slot&&files.length===1){const target=slot.closest('#scanSlots')?'scan':'edit';try{await putCardPhoto(target,slot.dataset.side,files[0])}catch(err){toast(err.message)}return}
  if($('#mEdit').classList.contains('on')){toast('請把照片拖到「名片照片」的框框裡');return}
  if($('#mScan').classList.contains('on'))closeModal($('#mScan'));
  addBatchFiles(files)});
$('#scanStop').onclick=()=>{if(scanCtl)scanCtl.abort()};
$('#scanManual').onclick=()=>{const ph={...slotState.scan};closeModal($('#mScan'));openEdit(normalize({}),{photos:ph})};
$('#eSave').onclick=saveEdit;
$('#eAddAddr').onclick=()=>addAddrRow(undefined,true);
$('#eAddrs').addEventListener('click',e=>{const b=e.target.closest('[data-adel]');if(b)b.closest('.addr-row').remove()});
$('#wipe').onclick=async()=>{if(await confirmBox(`確定清空全部 ${contacts.length} 張名片？\n建議先匯出 Excel 留一份。此動作無法復原。${Sync.linked()?'\n\n已開啟同步：其他裝置上的名片也會一起被刪除。':''}`,{ok:'清空',danger:true})&&await confirmBox('真的確定？',{ok:'確定清空',danger:true})){
  closeModal($('#mImport'));for(const c of [...contacts]){await Store.del(c).catch(()=>{})}contacts=[];S.sel=null;refresh();toast('已清空')}};
$('#photoInput').onchange=async e=>{const f=e.target.files[0];if(!f||!pickCtx)return;
  const ctx=pickCtx;try{await putCardPhoto(ctx.target,ctx.side,f);if(ctx.target==='scan')$('#scanStatus').hidden=true}catch(err){toast(err.message)}};
$('#importInput').onchange=e=>{const f=e.target.files[0];if(f)handleImport(f,e.target.dataset.kind)};
let qt;$('#q').oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{S.q=e.target.value;renderList()},150)};
$('#fRegion').onchange=e=>{S.region=e.target.value;renderList()};
$('#fProc').onchange=e=>{S.proc=e.target.value;renderList()};
$('#fSort').onchange=e=>{S.sort=e.target.value;renderList()};
$('#bFilter').onclick=()=>{const f=$('.frow');const o=f.classList.toggle('open');$('#bFilter').setAttribute('aria-expanded',String(o))};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#dlg').classList.contains('on'))return;if($('#zoom').classList.contains('on'))$('#zoom').classList.remove('on');else{const m=$$('.modal.on').pop();if(m)closeModal(m)}}});
/* ---------- settings UI ---------- */
function paintProv(){$$('#sProv label').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked))}
function fillProvider(p){const cur=AI.get();$('#sKey').value=cur.keys[p]||'';$('#sModel').value=cur.models[p]||PROVIDERS[p].models[0];
  $('#dlModels').innerHTML=PROVIDERS[p].models.map(m=>`<option value="${m}">`).join('');
  $('#sKeyLink').innerHTML=`還沒有金鑰？<a href="${PROVIDERS[p].keyUrl}" target="_blank" rel="noopener">到 ${PROVIDERS[p].name} 申請 API 金鑰 ↗</a>`;$('#sTestRes').textContent=''}
async function openSettings(){
  const cur=AI.get();$$('#sProv input').forEach(i=>i.checked=i.value===cur.provider);paintProv();fillProvider(cur.provider);
  const lb=await Meta.get('lastBackup');$('#sLastBackup').textContent=lb?fmtD(lb.slice(0,10))+`（${daysBetween(lb.slice(0,10),today())} 天前）`:'從未備份';
  try{const e=await navigator.storage.estimate();$('#sStorage').textContent=`目前使用 ${(e.usage/1048576).toFixed(1)} MB`}catch(_){$('#sStorage').textContent=''}
  $('#sVer').textContent=APP_VERSION;paintSync();
  openModal('#mSettings');
}
$('#bSettings').onclick=openSettings;
$('#sLog').onclick=()=>{$('#logBody').innerHTML=changelogHTML(CHANGELOG);openModal('#mLog')};
$('#sProv').addEventListener('change',e=>{paintProv();fillProvider(e.target.value)});
$('#sShow').onclick=()=>{const k=$('#sKey');k.type=k.type==='password'?'text':'password'};
$('#sSave').onclick=()=>{const p=($('#sProv input:checked')||{}).value||'claude';AI.set(p,$('#sKey').value.trim(),$('#sModel').value.trim());closeModal($('#mSettings'));toast('設定已儲存');};
$('#sTest').onclick=async()=>{
  const p=($('#sProv input:checked')||{}).value||'claude';const key=$('#sKey').value.trim();const model=$('#sModel').value.trim()||PROVIDERS[p].models[0];
  const out=$('#sTestRes');if(!key){out.textContent='請先貼上金鑰';return}
  out.textContent='測試中…';
  try{const t=await callAI('Reply with only this JSON: {"ok":true}',[],undefined,{provider:p,key,model});const j=parseJSONText(t);
    out.innerHTML=j&&j.ok?'<span style="color:var(--grn)">連線成功，可以使用</span>':'<span style="color:var(--org)">有連上，但回覆格式怪怪的</span>'}
  catch(e){out.innerHTML=`<span style="color:var(--red)">${esc(scanErrMsg(e&&e.code))}</span>`+(e&&e.status?`<br><span style="color:var(--sub);font-size:12.5px">錯誤代碼 ${e.status}：${esc(e.message||'')}</span>`:'')}
};

/* ---------- backup reminder + online state ---------- */
async function checkBackup(){setNotice('');return;
  if(!contacts.length){setNotice('');return}
  const lb=await Meta.get('lastBackup');const d=lb?daysBetween(lb.slice(0,10),today()):null;
  if(d===null||d>=30)setNotice(`${d===null?'還沒有備份過':'已經 '+d+' 天沒備份'}。資料只存在這台裝置，建議現在<a href="#" id="nBackup">做一次完整備份</a>。`);
  else setNotice('');
}
document.addEventListener('click',e=>{if(e.target.id==='nBackup'){e.preventDefault();openModal('#mExport')}});
function paintOnline(){paintSync()}
addEventListener('online',()=>{paintSync();Sync.run()});addEventListener('offline',paintOnline);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Sync.linked()&&Sync.tokenOk()){const l=Sync.st().last;if(!l||Date.now()-new Date(l)>60000)Sync.run()}});

/* ---------- start ---------- */
refresh();
(async()=>{
  paintOnline();
  const ok=await LDB.open();
  if(!ok){setNotice('這個瀏覽器無法使用本機資料庫，資料不會被儲存。iPhone 請用 Safari 打開，不要用私密瀏覽。',true);return}
  try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist()}catch(_){}
  try{contacts=(await LDB.all()).map(normalize)}catch(_){contacts=[]}
  refresh();checkBackup();
  try{await maybeMigrate()}catch(_){}
  setTimeout(()=>fixOldPhotos().catch(()=>{}),2500);
  const rd=Sync.takeRedirect();
  if(rd&&rd.ok){toast('已連結 Google 雲端硬碟，開始同步…',3000);Sync.run()}
  else if(rd&&rd.error){toast(rd.error==='access_denied'?'已取消 Google 登入':'Google 登入沒有成功，請再試一次',4000)}
  else if(Sync.linked())Sync.run();
  paintSync();
  try{const seen=localStorage.getItem('mpgj.seenVersion');localStorage.setItem('mpgj.seenVersion',APP_VERSION);
    if(seen&&seen!==APP_VERSION){const news=CHANGELOG.slice(0,Math.max(1,CHANGELOG.findIndex(c=>c.v===seen)));
      setTimeout(()=>infoBox(`已更新到版本 ${APP_VERSION}\n\n`+news.slice(0,2).map(c=>c.items.map(i=>'• '+i).join('\n')).join('\n')+(news.length>2?'\n\n更早的更新可以在「設定 → 更新紀錄」查看。':''),{ok:'知道了'}),500)}}catch(_){}
  let welcomed=false;try{welcomed=!!localStorage.getItem('mpgj.welcomed');localStorage.setItem('mpgj.welcomed','1')}catch(_){}
  if(!welcomed&&!AI.get().key&&!contacts.length&&!/access_token|error=/.test(location.hash))setTimeout(()=>infoBox('歡迎使用名片管家！\n\n要自動辨識名片，請先到右上角「設定」選一家 AI，貼上你自己的 API 金鑰。\n\n沒有金鑰也可以用：拍照後按「自己填」手動輸入。',{ok:'知道了'}),400);
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadCtl&&!reloaded){reloaded=true;toast('已更新到新版本');setTimeout(()=>location.reload(),600)}});
    try{const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});reg.update().catch(()=>{})}catch(_){}
  }
})();
