/* 名片管家：新增／編輯名片表單、拜訪紀錄表單 */
'use strict';
function addAddrRow(a={label:'',address:''},focus){
  const d=document.createElement('div');d.className='addr-row';
  d.innerHTML=`<input type="text" data-al placeholder="名稱，例：二廠" list="dlAddrLabel" value="${esc(a.label)}"><input type="text" data-aa placeholder="地址" value="${esc(a.address)}"><button type="button" class="btn sm danger" data-adel title="刪除這個地址" aria-label="刪除這個地址">${ic('trash')}</button>`;
  $('#eAddrs').appendChild(d);if(focus)d.querySelector('[data-al]').focus();
}

/* ---------- visit photos ---------- */
let vPend=[];let vPhotoTarget=null,vPhotoOwner=null; // null = visit page, else visit id (quick add from the list)
const VS={cid:null,vid:null,photos:[],removed:[],key:''};
function paintWho(sel,other){const c=contacts.find(x=>x.id===VS.cid);const box=$('#vWhoBox');if(!isCo(c)){box.hidden=true;$('#vWho').innerHTML='';$('#vOther').value='';return}box.hidden=false;sel=sel||[];
  const ppl=sortPeople(c);const extra=sel.filter(id=>!ppl.some(p=>p.id===id));
  $('#vWho').innerHTML=ppl.map(p=>`<label data-who="${p.id}" class="${sel.includes(p.id)?'on':''}">${esc(p.name)}</label>`).join('')
    +extra.map(id=>{const p=contacts.find(x=>x.id===id);const v=c.visits.find(x=>x.who.includes(id));const n=(p?p.name:(v?v.whoN[v.who.indexOf(id)]:''))||'?';return `<label data-who="${id}" class="on">${esc(n)}（已離職）</label>`}).join('')
    +(ppl.length||extra.length?'':'<span style="color:var(--sub);font-size:13px">這家公司還沒有聯絡人，可以填在下面「其他人」</span>');
  $('#vOther').value=other||''}const draftPhotos=new Map();let draftT=null;
const draftKey=(cid,vid)=>'mpgj.vdraft.'+cid+'.'+(vid||'new');
function paintPend(){const el=$('#vPend');if(!el)return;
  el.innerHTML=VS.photos.filter(p=>!VS.removed.includes(p.id)).map(p=>`<div class="th"><img data-vp="${p.id}" data-zoom alt="拜訪照片"><button data-pxdel="${p.id}" title="移除" aria-label="移除這張照片">${ic('x')}</button></div>`).join('')
    +vPend.map((d,i)=>`<div class="th"><img src="${d}" data-zoom alt=""><button data-pdel="${i}" title="移除" aria-label="移除">${ic('x')}</button></div>`).join('')+`<button class="add" data-padd>${ic('cam')}加照片</button>`;
  el.querySelectorAll('img[data-vp]').forEach(async img=>{const src=await VP.get(img.dataset.vp,VS.cid);if(src)img.src=src})}
function growTA(){const t=$('#vContent');t.style.height='auto';t.style.height=Math.max(150,t.scrollHeight+2)+'px'}
function paintTrial(){const tr=$('#vType').value==='試刀';$('#vTrial').hidden=!tr;
  $('#vContentLbl').textContent=tr?'試刀過程與心得':'內容';
  $('#vContent').placeholder=tr?'過程、遇到的問題、客戶反應、後續規劃…':'聊了什麼？（客戶需求、加工問題、競爭品牌、報價…）'}
function runCard(r,i,many){r=r||{};const v=k=>esc(r[k]||'');
  return `<div class="run${r.best?' best':''}" data-ri="${i}">
    <div class="rhead"><b>${many?`第 ${i+1} 組`:'試刀條件'}</b>${r.best?'<span class="badge cat-客戶">建議條件</span>':''}<span class="sp"></span>
      <button type="button" class="rbtn${r.best?' on':''}" data-rbest aria-label="標成建議條件" aria-pressed="${!!r.best}" title="標成建議條件"><svg class="i" aria-hidden="true" viewBox="0 0 24 24" fill="${r.best?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg></button>
      ${many?`<button type="button" class="rbtn" data-rdel aria-label="刪除這一組" title="刪除這一組">${ic('trash')}</button>`:''}</div>
    <label class="f"><span>試用刀具</span><input type="text" data-k="tool" value="${v('tool')}" placeholder="例：AH8015 TNMG160408"></label>
    <div class="cut">
      <label>Vc<small>m/min</small><input type="text" inputmode="decimal" data-k="vc" value="${v('vc')}"></label>
      <label>f<small>mm/rev・mm/t</small><input type="text" inputmode="decimal" data-k="f" value="${v('f')}"></label>
      <label>ap<small>mm</small><input type="text" inputmode="decimal" data-k="ap" value="${v('ap')}"></label>
      <label>S 轉速<small>min⁻¹</small><input type="text" inputmode="decimal" data-k="n" value="${v('n')}"></label>
      <label>F 進給<small>mm/min</small><input type="text" inputmode="decimal" data-k="fm" value="${v('fm')}"></label>
      <label>冷卻<small>${optPlus('cool',' data-opt-for="cool"').replace('class="oplus"','class="oplus mini"').replace('</svg>','</svg>新增')}</small><select data-k="cool"><option value=""></option>${optWith('cool',[r.cool]).map(c=>`<option ${r.cool===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    </div>
    <label class="f"><span>壽命</span><input type="text" data-k="life" value="${v('life')}" placeholder="例：120 件、45 分鐘、崩刃"></label>
    <div class="f"><span class="fl">結果</span><div class="checks rres">${optWith('result',[r.result]).map(x=>`<label class="${r.result===x?'on':''}${optOld('result',x)?' old':''}" data-res="${esc(x)}">${esc(x)}</label>`).join('')}${optPlus('result',' data-opt-for="result"')}</div></div>
    <label class="f"><span>這組的備註</span><input type="text" data-k="note" value="${v('note')}" placeholder="例：第 2 件開始有振刀"></label>
  </div>`}
function readRuns(){return $$('#tRuns .run').map(el=>{const r={};el.querySelectorAll('[data-k]').forEach(i=>r[i.dataset.k]=i.value);
  r.result=((el.querySelector('.rres label.on')||{}).dataset||{}).res||'';r.best=el.classList.contains('best');return r})}
function renderRuns(runs){runs=runs&&runs.length?runs:[{}];$('#tRuns').innerHTML=runs.map((r,i)=>runCard(r,i,runs.length>1)).join('')}
function readVisitForm(){const t={mat:$('#tMat').value,proc:$('#tProc').value,ref:$('#tRef').value,refLife:$('#tRefLife').value,surf:$('#tSurf').value,runs:readRuns()};
  return{date:$('#vDate').value,type:$('#vType').value,content:$('#vContent').value,next:$('#vNext').value,follow:$('#vFollow').value,trial:t,who:$$('#vWho label.on').map(l=>l.dataset.who),other:$('#vOther').value}}
function fillVisitForm(d){const t0=cleanTrial(d.trial)||{};const ty=d.type||(VTYPES.includes('拜訪')?'拜訪':VTYPES[0]);fillOptSelects({vtype:ty,proc:t0.proc});
  $('#vDate').value=d.date||today();$('#vType').value=ty;$('#vContent').value=d.content||'';$('#vNext').value=d.next||'';$('#vFollow').value=d.follow||'';
  const t=cleanTrial(d.trial)||{};for(const k of TRIAL_SHARED){const el=$('#t'+k[0].toUpperCase()+k.slice(1));if(el)el.value=t[k]||''}
  renderRuns(t.runs);paintTrial();paintWho(d.who,d.other);setTimeout(growTA,0)}
function visitBase(c,vid,who){const v=vid&&c.visits.find(x=>x.id===vid);
  return v?{date:v.date,type:v.type,content:v.content,next:v.next,follow:'',trial:v.trial||{},who:v.who,other:v.other}:{date:today(),type:VTYPES.includes('拜訪')?'拜訪':VTYPES[0],content:'',next:'',follow:c.nextFollow&&c.nextFollow>today()?c.nextFollow:'',trial:{},who:who||[],other:''}}
function showDraftBar(at){const b=$('#vDraft');const has=!!at;b.hidden=!has;if(has)$('#vDraftTx').textContent=(VS.vid?'有還沒儲存的修改':'已自動保存草稿')+'・'+fmtTime(at)}
function saveDraft(){clearTimeout(draftT);const key=VS.key,vid=VS.vid;draftT=setTimeout(()=>{if(VS.key!==key)return;
  const d={...readVisitForm(),at:new Date().toISOString()};
  const empty=!vid&&!d.content.trim()&&!d.next.trim()&&!cleanTrial(d.trial)&&!vPend.length;
  if(empty){try{localStorage.removeItem(key)}catch(_){}draftPhotos.delete(key);showDraftBar(null);return}
  try{localStorage.setItem(key,JSON.stringify(d))}catch(_){}draftPhotos.set(key,{pend:[...vPend],removed:[...VS.removed]});showDraftBar(d.at)},400)}
function openVisit(c,vid,opt={}){VS.preWho=opt.who||[];
  VS.cid=c.id;VS.vid=vid||null;VS.key=draftKey(c.id,vid);const v=vid&&c.visits.find(x=>x.id===vid);VS.photos=v?[...(v.photos||[])]:[];
  $('#vTitle').textContent=v?'修改紀錄':'新增紀錄';
  let d=null;try{d=JSON.parse(localStorage.getItem(VS.key)||'null')}catch(_){}
  const mem=draftPhotos.get(VS.key);vPend=mem?[...mem.pend]:[];VS.removed=mem?[...mem.removed]:[];
  fillVisitForm(d||visitBase(c,vid,VS.preWho));showDraftBar(d&&d.at);paintPend();openModal('#mVisit');
  if(!v&&!d)setTimeout(()=>$('#vContent').focus({preventScroll:true}),250)}
function clearDraft(){clearTimeout(draftT);try{localStorage.removeItem(VS.key)}catch(_){}draftPhotos.delete(VS.key)}
async function saveVisit(){const c=contacts.find(x=>x.id===VS.cid);if(!c)return;const f=readVisitForm();
  const trial=f.type==='試刀'?cleanTrial(f.trial):null;
  const keep=VS.photos.filter(p=>!VS.removed.includes(p.id));
  if(!f.content.trim()&&!f.next.trim()&&!vPend.length&&!keep.length&&!trial){toast('請填寫內容、下一步，或加一張照片');return}
  const btn=$('#vSave');btn.disabled=true;
  try{const added=await storePend();
    const isC=isCo(c);const who=isC?f.who:[];const whoN=who.map(id=>{const p=contacts.find(x=>x.id===id);if(p)return p.name;const o=c.visits.find(x=>x.who.includes(id));return o?o.whoN[o.who.indexOf(id)]||'':''});
    const v={id:VS.vid||uid(),date:f.date||today(),type:f.type,content:half(f.content.trim()),next:half(f.next.trim()),updated:new Date().toISOString(),trial,who,whoN,other:isC?f.other.trim():'',photos:[...keep,...added]};
    for(const pid of VS.removed)await VP.del(pid,c.id);
    const nc={...c,visits:VS.vid?c.visits.map(x=>x.id===VS.vid?v:x):[...c.visits,v],deletedPhotos:[...(c.deletedPhotos||[]),...VS.removed]};
    if(f.follow)nc.nextFollow=f.follow;
    await save(nc);clearDraft();VS.removed=[];closeModal($('#mVisit'));refresh();toast(VS.vid?'已更新紀錄':'已新增紀錄')}
  catch(_){toast('儲存失敗，請檢查網路')}finally{btn.disabled=false}}
/* 下拉選單：跟著自訂選項走；目前選的是舊名字時也保留 */
function fillOptSelects(cur){cur=cur||{vtype:$('#vType').value,proc:$('#tProc').value};
  $('#vType').innerHTML=optWith('vtype',[cur.vtype]).map(t=>`<option>${esc(t)}</option>`).join('');if(cur.vtype)$('#vType').value=cur.vtype;
  $('#tProc').innerHTML='<option value="">（選擇）</option>'+optWith('proc',[cur.proc]).map(p=>`<option>${esc(p)}</option>`).join('');$('#tProc').value=cur.proc||'';
  $('#dlMat').innerHTML=MATERIALS.map(m=>`<option value="${esc(m)}">`).join('')}
fillOptSelects();
/* 下拉選單、輸入框旁邊放「＋」 */
for(const [sel,k] of [['#vType','vtype'],['#tProc','proc'],['#tMat','mat'],['#eForm [name=region]','region']]){const el=$(sel);const w=document.createElement('span');w.className='optrow';
  el.replaceWith(w);w.append(el);w.insertAdjacentHTML('beforeend',optPlus(k,` data-opt-for="${sel}"`))}
/* 按「＋」→ 編輯選項；剛新增的選項直接幫你選好 */
document.addEventListener('click',e=>{const b=e.target.closest('[data-opt]');if(!b)return;e.preventDefault();e.stopPropagation();
  const k=b.dataset.opt,fr=b.dataset.optFor||'',run=b.closest('.run'),ri=run?+run.dataset.ri:-1;
  openOpts(k,added=>{const a=added[0];if(!a)return;
    if(fr==='eCat'||fr==='eStatus'){const i=$(`#${fr} input[value="${CSS.escape(a)}"]`);if(i){i.checked=true;paintChecks();i.dispatchEvent(new Event('change',{bubbles:true}))}}
    else if(fr==='eProc'){for(const n of added){const i=$(`#eProc input[value="${CSS.escape(n)}"]`);if(i)i.checked=true}paintChecks()}
    else if(fr==='cool'||fr==='result'){const r=$$('#tRuns .run')[ri];if(r){if(fr==='cool')r.querySelector('[data-k=cool]').value=a;else{const l=r.querySelector(`.rres label[data-res="${CSS.escape(a)}"]`);if(l){r.querySelectorAll('.rres label').forEach(x=>x.classList.remove('on'));l.classList.add('on')}}}}
    else if(fr){const el=$(fr);if(el){el.value=a;if(fr==='#vType')paintTrial()}}
    if($('#mVisit').classList.contains('on'))saveDraft()})},true);
$('#tRuns').addEventListener('click',e=>{const run=e.target.closest('.run');if(!run)return;
  const rl=e.target.closest('.rres label');if(rl){const on=!rl.classList.contains('on');run.querySelectorAll('.rres label').forEach(l=>l.classList.remove('on'));if(on)rl.classList.add('on');saveDraft();return}
  if(e.target.closest('[data-rbest]')){const runs=readRuns();const i=+run.dataset.ri;const was=runs[i].best;runs.forEach(r=>r.best=false);runs[i].best=!was;renderRuns(runs);saveDraft();return}
  if(e.target.closest('[data-rdel]')){const runs=readRuns();const i=+run.dataset.ri;runs.splice(i,1);renderRuns(runs);saveDraft();return}});
$('#tAddRun').onclick=()=>{const runs=readRuns();const last=runs[runs.length-1]||{};runs.push({tool:last.tool,vc:last.vc,f:last.f,ap:last.ap,n:last.n,fm:last.fm,cool:last.cool});renderRuns(runs);saveDraft();
  const cards=$$('#tRuns .run');const nc=cards[cards.length-1];if(nc){nc.scrollIntoView({behavior:'smooth',block:'center'});const i=nc.querySelector('[data-k=vc]');if(i)setTimeout(()=>i.focus({preventScroll:true}),350)}};
$('#vType').addEventListener('change',()=>{paintTrial();saveDraft()});
$('#mVisit').addEventListener('change',e=>{if(e.target.matches('select'))saveDraft()});
$('#mVisit').addEventListener('input',e=>{if(e.target.id==='vContent')growTA();saveDraft()});
$('#vSave').onclick=saveVisit;
$('#vWho').addEventListener('click',e=>{const l=e.target.closest('[data-who]');if(!l)return;l.classList.toggle('on');saveDraft()});
$('#vDraftClr').onclick=async()=>{if(!await confirmBox('清除這份草稿？\n（還沒儲存的內容和照片都會清掉）',{ok:'清除',danger:true}))return;
  clearDraft();vPend=[];VS.removed=[];const c=contacts.find(x=>x.id===VS.cid);fillVisitForm(visitBase(c||{visits:[]},VS.vid,VS.preWho));showDraftBar(null);paintPend();toast('已清除草稿')};
const vpInput=document.createElement('input');vpInput.type='file';vpInput.accept='image/*';vpInput.multiple=true;vpInput.hidden=true;document.body.appendChild(vpInput);
vpInput.onchange=async()=>{const files=[...vpInput.files];if(!files.length)return;const out=[];
  for(const f of files){try{out.push(await fileToPhoto(f))}catch(e){toast(e.message)}}
  if(vPhotoTarget===null){vPend=vPend.concat(out);paintPend();saveDraft();return}
  const c=contacts.find(x=>x.id===(vPhotoOwner||S.sel));if(!c)return;const v=c.visits.find(x=>x.id===vPhotoTarget);if(!v)return;
  const add=[];for(const d of out){const id=uid();await VP.put(id,d,c.id);add.push({id,h:hashStr(d)})}
  const nc={...c,visits:c.visits.map(x=>x.id===v.id?{...x,photos:[...(x.photos||[]),...add]}:x)};
  try{await save(nc);renderDetail();toast(`已加入 ${add.length} 張照片`)}catch(_){toast('儲存失敗')}};
function pickVisitPhotos(target,owner){vPhotoTarget=target;vPhotoOwner=owner||null;vpInput.value='';vpInput.click()}
async function storePend(){const arr=[];for(const d of vPend){const id=uid();await VP.put(id,d,VS.cid);arr.push({id,h:hashStr(d)})}vPend=[];return arr}

/* ---------- 生日、車輛與保險 ---------- */
$('#eBdM').innerHTML='<option value="">月</option>'+Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join('');
function paintBdDays(){const m=+$('#eBdM').value,y=readBdYear()||2000,cur=$('#eBdD').value;const n=m?new Date(y,m,0).getDate():31;
  $('#eBdD').innerHTML='<option value="">日</option>'+Array.from({length:n},(_,i)=>`<option value="${i+1}">${i+1} 日</option>`).join('');if(cur&&+cur<=n)$('#eBdD').value=cur}
/* 年份：西元 4 位數；1～3 位數當成民國年 */
function readBdYear(){const v=half($('#eBdY').value).replace(/\D/g,'');if(!v)return 0;const n=+v;return v.length===4?n:n>0&&n<200?n+1911:0}
$('#eBdM').onchange=paintBdDays;$('#eBdY').addEventListener('change',paintBdDays);
function fillBirthday(s){const b=bdParts(s);$('#eBdM').value=b?b.m:'';$('#eBdY').value=b&&b.y?b.y:'';paintBdDays();$('#eBdD').value=b?b.d:''}
function readBirthday(){const m=+$('#eBdM').value,d=+$('#eBdD').value,y=readBdYear();if(!m||!d)return '';return (y?y+'-':'')+pad(m)+'-'+pad(d)}
function addCarRow(x={plate:'',exp:''},focus){const d=document.createElement('div');d.className='car-row';
  d.innerHTML=`<label><small>車牌</small><input type="text" data-cp value="${esc(x.plate)}" placeholder="例：ABC-1234" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></label><label><small>保險到期日</small><input type="date" data-ce value="${esc(x.exp)}"></label><button type="button" class="btn sm danger" data-cdel title="刪除這台車" aria-label="刪除這台車">${ic('trash')}</button>`;
  $('#eCars').appendChild(d);if(focus)d.querySelector('[data-cp]').focus()}
const readCars=()=>$$('#eCars .car-row').map(r=>({plate:fmtPlate(r.querySelector('[data-cp]').value),exp:r.querySelector('[data-ce]').value})).filter(x=>x.plate||x.exp);
$('#eAddCar').onclick=()=>addCarRow(undefined,true);
$('#eCars').addEventListener('click',e=>{const b=e.target.closest('[data-cdel]');if(b)b.closest('.car-row').remove()});
/* 車牌：打字時就轉成大寫（注音輸入法組字中先不動），離開欄位時整理成「ABC-1234」 */
$('#eCars').addEventListener('input',e=>{const el=e.target;if(!el.matches('[data-cp]')||e.isComposing)return;const v=half(el.value).toUpperCase();if(v!==el.value){const p=el.selectionStart;el.value=v;try{el.setSelectionRange(p,p)}catch(_){}}});
$('#eCars').addEventListener('compositionend',e=>{const el=e.target;if(el.matches('[data-cp]'))el.value=half(el.value).toUpperCase()});
$('#eCars').addEventListener('focusout',e=>{const el=e.target;if(el.matches('[data-cp]'))el.value=fmtPlate(el.value)});

/* ---------- edit modal ---------- */
let editing=null,editPhotosOrig={front:'',back:''},EM='p';
function paintEditMode(){const f=$('#eForm');const co=EM==='co';
  $$('#eForm [data-m=p]').forEach(el=>el.hidden=co);
  $$('#eForm [data-m=o]').forEach(el=>el.hidden=!co);$('#eMergeBox').hidden=!co||!contacts.some(x=>x.id===editing.id);
  $('#eCoLbl').textContent=co?'公司名稱 *':'公司';$('#ePhLbl').textContent=co?'公司電話（總機）':'公司電話（含分機）';
  $('#eFollowSec').textContent=co?'跟進與備註':'認識情境與跟進';
  let hint='',hideC=false;
  if(!co){const cat=(f.querySelector('[name=category]:checked')||{}).value||'';const name=f.querySelector('[name=company]').value.trim();
    if(name&&cat!==INS_CAT){const cur=coOf(editing);const ex=cur&&normCo(cur.company)===normCo(name)?cur:findCo(name,f.querySelector('[name=taxId]').value);
      if(ex){hideC=true;hint=`狀態、加工類型、刀具品牌、跟進日期和拜訪紀錄都記在「${esc(ex.company)}」的公司頁。`}
      else hint=`儲存後會建立「${esc(name)}」公司（或讓你選要加入哪一家），下面的狀態、加工類型、刀具品牌、跟進日期會記在公司。`}
    else if(name&&cat===INS_CAT)hint='分類是「保險」，紀錄和跟進日期記在這個人身上，不會建立公司。'}
  {const cat=(f.querySelector('[name=category]:checked')||{}).value||'';const show=!co&&cat===INS_CAT;$$('#eForm [data-ins]').forEach(el=>el.hidden=!show);
    if(show&&!$$('#eCars .car-row').length)addCarRow()}
  $$('#eForm [data-m=c]').forEach(el=>el.hidden=hideC);
  const h=$('#eHint');h.hidden=!hint;h.innerHTML=hint}
$('#eForm').addEventListener('click',e=>{const l=e.target.closest('.checks label');if(!l)return;const i=l.querySelector('input[type=radio]');if(!i)return;
  e.preventDefault();i.checked=!i.checked;paintChecks();i.dispatchEvent(new Event('change',{bubbles:true}))});
$('#eForm').addEventListener('input',e=>{if(e.target.name==='company'||e.target.name==='taxId')paintEditMode()});
$('#eForm').addEventListener('change',e=>{if(e.target.name==='category')paintEditMode()});
/* 存好一個人之後：接到對的公司（同統編或同名直接加入；很像的問一下；換工作就換公司，舊紀錄留在舊公司） */
async function attach(p){
  if(!linkable(p)){if(p.companyId){const np={...p,companyId:''};await save(np);return{p:np}}return{p}}
  const cur=coOf(p);
  if(cur&&(normCo(cur.company)===normCo(p.company)||(validTaxId(p.taxId)&&p.taxId===cur.taxId))){if(p.logo&&!cur.logo&&!cur.logoOff)await save({...cur,logo:p.logo,logoTone:p.logoTone||''});return{p}}
  let target=findCo(p.company,p.taxId);
  if(!target){const fz=fuzzyCo(p.company);if(fz&&await confirmBox(`「${p.company}」跟已經有的「${fz.company}」很像。\n\n是同一家公司嗎？（不同廠區也算同一家）`,{ok:'加入這家公司',cancel:'建立新公司'}))target=fz}
  const isNew=!target;const [np,co]=await linkTo(p,target||newCoFor(p),!!cur&&!!target);
  return{p:np,co,isNew,moved:!!cur&&cur.id!==co.id}}

function openModal(id){const el=$(id);const was=el.classList.contains('on');el.classList.add('on');document.body.style.overflow='hidden';
  if(!was&&isNarrow()){const st={modal:el.id};if(history.state&&history.state.modal)history.replaceState(st,'');else history.pushState(st,'')}}
function closeModal(el,fromPop){el.classList.remove('on');if(!$$('.modal.on').length)document.body.style.overflow='';
  if(!fromPop)setTimeout(()=>{if(!$$('.modal.on').length&&history.state&&history.state.modal){skipPop++;history.back()}},0)}
function paintChecks(){$$('#eForm .checks label').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked))}
/* 類別、狀態、加工類型、地區的選項（舊名字也列出來，虛線框，存檔時不會不見） */
function paintEditOpts(cur){const f=$('#eForm');const chip=(type,name,k,val,on)=>`<label${optOld(k,val)?' class="old" title="這個選項已經改名或刪除，舊資料保留原本的名字"':''}><input type="${type}"${name?` name="${name}"`:''} value="${esc(val)}" ${on?'checked':''}>${esc(val)}</label>`;
  const rg=f.querySelector('[name=region]');rg.innerHTML='<option value="">（未選）</option>'+optWith('region',[cur.region]).map(r=>`<option>${esc(r)}</option>`).join('');rg.value=cur.region||'';
  $('#eCat').innerHTML=optWith('cat',[cur.category]).map(x=>chip('radio','category','cat',x,cur.category===x)).join('')+optPlus('cat',' data-opt-for="eCat"');
  $('#eStatus').innerHTML=optWith('status',[cur.status]).map(x=>chip('radio','status','status',x,cur.status===x)).join('')+optPlus('status',' data-opt-for="eStatus"');
  $('#eProc').innerHTML=optWith('proc',cur.processes||[]).map(p=>chip('checkbox','','proc',p,(cur.processes||[]).includes(p))).join('')+optPlus('proc',' data-opt-for="eProc"');
  paintChecks()}
function readEditOpts(){const f=$('#eForm');return{category:(f.querySelector('[name=category]:checked')||{}).value||'',status:(f.querySelector('[name=status]:checked')||{}).value||'',processes:$$('#eProc input:checked').map(i=>i.value),region:f.querySelector('[name=region]').value}}
async function openEdit(c,opt={}){
  editing=JSON.parse(JSON.stringify(c||normalize({})));EM=isCo(editing)?'co':'p';
  const isNew=!contacts.some(x=>x.id===editing.id);
  $('#eTitle').textContent=EM==='co'?(isNew?'新增公司':'編輯公司'):isNew?(opt.fromScan?'確認辨識結果':'新增名片'):'編輯名片';
  const f=$('#eForm');
  paintEditOpts(editing);
  FIELDS.forEach(k=>{f.querySelector(`[name=${k}]`).value=editing[k]||''});
  $('#eAddrs').innerHTML='';(editing.addresses||[]).forEach(a=>addAddrRow(a));
  fillBirthday(editing.birthday);$('#eCars').innerHTML='';(editing.cars||[]).forEach(x=>addCarRow(x));
  if(EM==='co')f.querySelector('[name=company]').value=editing.company||'';
  f.querySelector('[name=aka]').value=(editing.aka||[]).join('、');
  paintChecks();paintEditMode();
  const unc=new Set(opt.uncertain||[]);
  $$('#eForm label.f[data-k]').forEach(l=>l.classList.toggle('warn',unc.has(l.dataset.k)));
  const note=$('#aiNote');
  if(opt.fromScan){note.hidden=false;note.innerHTML=`Claude 已經讀好名片，請<b>對照照片看一下</b>再儲存。${unc.size?'黃色欄位是比較不確定的地方。':''}<br>順便選一下類別、加工類型，填個跟進日期。`}else note.hidden=true;
  if(opt.photos){slotState.edit={...opt.photos};slotOrig.edit={...slotOrig.scan};editPhotosOrig={front:'',back:''}}
  else{slotState.edit={front:'',back:''};slotOrig.edit={front:null,back:null};editPhotosOrig={front:'',back:''};
    if(!isNew){for(const s of ['front','back'])if(editing['has'+(s==='front'?'Front':'Back')]){const d=await Store.getPhoto(editing.id,s);slotState.edit[s]=d;editPhotosOrig[s]=d}}}
  paintSlots('edit');
  openModal('#mEdit');
  $('#mEdit .mbox').scrollIntoView({block:'start'});
}
async function saveCoEdit(){const f=$('#eForm');
  for(const k of CO_FIELDS)editing[k]=half(f.querySelector(`[name=${k}]`).value.trim());
  editing.aka=[...new Set(f.querySelector('[name=aka]').value.split(/[、,，;；\n]/).map(x=>x.trim()).filter(x=>x&&x!==editing.company))];
  if(!editing.company){toast('請填寫公司名稱');f.querySelector('[name=company]').focus();return}
  editing.taxId=editing.taxId.replace(/\D/g,'');
  if(editing.taxId&&!validTaxId(editing.taxId)&&!await confirmBox(`統一編號「${editing.taxId}」的檢查碼對不起來，可能有一個數字看錯了。\n\n還是要儲存嗎？`,{ok:'仍要儲存',cancel:'回去修改'}))return;
  editing.category=(f.querySelector('[name=category]:checked')||{}).value||'';
  editing.status=(f.querySelector('[name=status]:checked')||{}).value||'';
  editing.processes=$$('#eProc input:checked').map(i=>i.value);
  editing.addresses=$$('#eAddrs .addr-row').map(r=>({label:r.querySelector('[data-al]').value.trim(),address:r.querySelector('[data-aa]').value.trim()})).filter(a=>a.address);
  if(!editing.region)editing.region=findRegion(editing.address)||'';
  const dupCo=contacts.find(x=>isCo(x)&&x.id!==editing.id&&(normCo(x.company)===normCo(editing.company)||(validTaxId(editing.taxId)&&x.taxId===editing.taxId)));
  if(dupCo&&!await confirmBox(`已經有「${dupCo.company}」了，可能是同一家公司。\n\n還是要另外存一家嗎？（要合併的話，到其中一家的「編輯公司」最下面選「合併到另一家」）`,{ok:'仍要儲存'}))return;
  const btn=$('#eSave');btn.disabled=true;btn.textContent='儲存中…';
  try{await save(editing);
    for(const p of peopleOf(editing))if(p.company!==editing.company||(!p.taxId&&editing.taxId))await save({...p,company:editing.company});
    closeModal($('#mEdit'));S.sel=editing.id;if(isNarrow()){if(history.state&&history.state.modal)history.replaceState({detail:S.sel},'');else if(!(history.state&&history.state.detail))history.pushState({detail:S.sel},'')}refresh();toast('已儲存')}
  catch(e){toast('儲存失敗：'+((e&&e.message)||'請檢查網路'),4000)}
  finally{btn.disabled=false;btn.textContent='儲存'}}
async function saveEdit(){
  if(EM==='co')return saveCoEdit();
  const f=$('#eForm');
  FIELDS.forEach(k=>{editing[k]=half(f.querySelector(`[name=${k}]`).value.trim())});
  if(!!$('#eBdM').value!==!!$('#eBdD').value){toast('生日請把月和日都選好');$('#eBdM').focus();return}
  editing.birthday=readBirthday();editing.cars=readCars();
  if(!editing.name){toast('請填寫姓名');f.querySelector('[name=name]').focus();return}
  editing.taxId=editing.taxId.replace(/\D/g,'');
  if(editing.taxId&&!validTaxId(editing.taxId)&&!await confirmBox(`統一編號「${editing.taxId}」的檢查碼對不起來，可能有一個數字看錯了。\n\n還是要儲存嗎？`,{ok:'仍要儲存',cancel:'回去修改'}))return;
  editing.category=(f.querySelector('[name=category]:checked')||{}).value||'';
  editing.status=(f.querySelector('[name=status]:checked')||{}).value||'';
  editing.processes=$$('#eProc input:checked').map(i=>i.value);
  editing.addresses=$$('#eAddrs .addr-row').map(r=>({label:half(r.querySelector('[data-al]').value.trim()),address:half(r.querySelector('[data-aa]').value.trim())})).filter(a=>a.address);
  if(!editing.region)editing.region=findRegion(editing.address)||'';
  const dig=s=>(s||'').replace(/\D/g,'');
  const dup=contacts.find(x=>!isCo(x)&&x.id!==editing.id&&((editing.email&&x.email&&x.email.toLowerCase()===editing.email.toLowerCase())||(dig(editing.mobile).length>=8&&dig(x.mobile)===dig(editing.mobile))));
  if(dup&&!await confirmBox(`「${dup.name}（${dup.company||'無公司'}）」的 Email 或手機跟這張一樣，可能是同一個人。\n\n還是要另外儲存一張嗎？`,{ok:'仍要儲存'}))return;
  const btn=$('#eSave');btn.disabled=true;btn.textContent='儲存中…';
  try{
    for(const s of ['front','back']){
      const v=slotState.edit[s]||'';
      if(v!==editPhotosOrig[s])await setPhoto(editing,s,v);
      editing['has'+(s==='front'?'Front':'Back')]=!!v;
    }
    if(slotState.edit.front!==editPhotosOrig.front||!editing.thumb!==!slotState.edit.front)editing.thumb=await makeThumb(slotState.edit.front);
    attaching++;let r;try{await save(editing);r=await attach(contacts.find(x=>x.id===editing.id)||editing)}finally{attaching--}
    closeModal($('#mEdit'));S.sel=editing.id;if(isNarrow()){if(history.state&&history.state.modal)history.replaceState({detail:S.sel},'');else if(!(history.state&&history.state.detail))history.pushState({detail:S.sel},'')}refresh();toast(r.co?(r.moved?`已改到「${r.co.company}」，舊公司的紀錄會保留並標示已離職`:r.isNew?`已儲存，並建立「${r.co.company}」公司`:`已儲存，加入「${r.co.company}」`):'已儲存',3000);
  }catch(e){toast('儲存失敗：'+(e&&e.code==='quota_exceeded'?'雲端空間已滿':(e&&e.message)||'請檢查網路'),4000)}
  finally{btn.disabled=false;btn.textContent='儲存'}
}
