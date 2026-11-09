/* 名片管家：公司與聯絡人、清單、詳細頁、分享、返回手勢 */
'use strict';
/* ---------- 公司與聯絡人 ----------
   公司也是一筆資料（kind:'co'），聯絡人用 companyId 連到公司。
   拜訪紀錄記在公司上，每筆用 who 記下這次的窗口；私人（或沒有公司）的人，紀錄和跟進記在自己身上。 */
const isCo=c=>!!c&&c.kind==='co';
const coOf=p=>p&&p.companyId?contacts.find(x=>x.id===p.companyId&&isCo(x))||null:null;
const peopleOf=co=>contacts.filter(p=>!isCo(p)&&p.companyId===co.id);
const linkable=p=>!isCo(p)&&!!(p.company||'').trim()&&p.category!=='私人';
const isRow=c=>isCo(c)||!coOf(c);
const rowTitle=c=>isCo(c)?c.company:c.name;
function normCo(s){return String(s||'').toLowerCase().replace(/[（(]股[)）]/g,'').replace(/[\s　()（）．.,，、\-]/g,'').replace(/股份有限公司|有限公司|企業社|工業社|實業社|股份|公司$/g,'').replace(PLANT_RE,'')}
const PLANT_RE=/((台北|臺北|新北|桃園|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東|基隆|林口|觀音|中壢|楊梅|大園|湖口|竹北|大雅|太平|大里|鹿港|和美|斗六|永康|仁武|岡山|路竹|樹林|五股|土城|三重|新莊|泰山|龜山|平鎮|大甲|清水|潭子|豐原|神岡|烏日|霧峰|南科|中科|竹科)(總?廠|廠區|分公司|營業所|辦事處)|第?[一二三四五六七八九十\d]+廠|廠區|分公司|營業所|辦事處)$/;
function findCo(name,taxId){const t=(taxId||'').replace(/\D/g,'');
  if(validTaxId(t)){const byT=contacts.find(x=>isCo(x)&&x.taxId===t);if(byT)return byT}
  const n=normCo(name);return n?contacts.find(x=>isCo(x)&&coNames(x).some(m=>normCo(m)===n)&&!(validTaxId(t)&&validTaxId(x.taxId)&&x.taxId!==t))||null:null}
const coNames=x=>[x.company,...(x.aka||[])].filter(Boolean);
function fuzzyCo(name){const n=normCo(name);if(n.length<2)return null;
  return contacts.find(x=>isCo(x)&&coNames(x).some(nm=>{const m=normCo(nm);return m.length>=2&&m!==n&&(m.includes(n)||n.includes(m))}))||null}
const TITLE_RANK=[['董事長',0],['總裁',1],['執行長',1],['副總',4],['總經理',2],['特助',5],['協理',6],['副廠長',8],['廠長',7],['總監',7],['副理',10],['經理',9],['襄理',11],['課長',12],['主任',13],['組長',14],['領班',15],['工程師',16],['專員',17],['業務',18],['助理',19]];
const titleRank=t=>{t=t||'';const r=TITLE_RANK.find(([k])=>t.includes(k));return r?r[1]:50};
const visitN=(p,co)=>co.visits.filter(v=>v.who.includes(p.id)).length;
function sortPeople(co,list){list=list||peopleOf(co);const hasV=co.visits.some(v=>v.who.length);const cmp=(a,b)=>a.localeCompare(b,'zh-Hant');
  return [...list].sort((a,b)=>(hasV?visitN(b,co)-visitN(a,co):0)||titleRank(a.title)-titleRank(b.title)||cmp(a.name,b.name))}
function formerOf(co){const now=new Set(peopleOf(co).map(p=>p.id));const m=new Map();
  co.visits.forEach(v=>v.who.forEach((id,i)=>{if(!now.has(id)&&!m.has(id)){const p=contacts.find(x=>x.id===id);m.set(id,{id,name:p?p.name:(v.whoN[i]||'?'),p})}}));return [...m.values()]}
function whoHTML(v,co){const parts=v.who.map((id,i)=>{const p=contacts.find(x=>x.id===id);const n=p?p.name:(v.whoN[i]||'');if(!n)return '';
    return `<b>${esc(n)}</b>${p&&co&&p.companyId!==co.id?'<span class="lft">已離職</span>':''}`}).filter(Boolean);
  if(v.other)parts.push(esc(v.other));return parts.length?`<div class="wh">窗口：${parts.join('、')}</div>`:''}
/* 合併兩家公司：from 的聯絡人、拜訪紀錄搬到 to，from 的名字留在 to 的「其他名稱」 */
async function mergeCo(from,to){
  const t={...to,visits:[...to.visits],addresses:[...to.addresses],processes:[...to.processes],aka:[...(to.aka||[])]};
  for(const k of ['taxId','phone','fax','address','website','region','brands','status','category','notes'])if(!t[k]&&from[k])t[k]=from[k];
  if(from.notes&&to.notes&&from.notes!==to.notes)t.notes=to.notes+'\n'+from.notes;
  const have=new Set([t.address,...t.addresses.map(a=>a.address)]);
  for(const a of [{label:from.company,address:from.address},...from.addresses])if(a.address&&!have.has(a.address)){t.addresses.push({label:a.label||'',address:a.address});have.add(a.address)}
  t.processes=[...new Set([...t.processes,...from.processes])];
  if(from.nextFollow&&(!t.nextFollow||from.nextFollow<t.nextFollow))t.nextFollow=from.nextFollow;
  t.aka=[...new Set([...t.aka,...coNames(from)])].filter(x=>x!==t.company);
  if(!t.logo&&!t.logoOff&&from.logo){t.logo=from.logo;t.logoTone=from.logoTone||''}
  const ids=new Set(t.visits.map(v=>v.id));
  t.visits.push(...from.visits.filter(v=>!ids.has(v.id)).map(v=>({...v,photos:(v.photos||[]).map(ph=>ph.o?ph:{...ph,o:from.id})})));
  await save(t);
  for(const p of peopleOf(from))await save({...p,companyId:t.id,company:t.company});
  await Store.del({...from,visits:[]});contacts=contacts.filter(x=>x.id!==from.id);
  return t}
function openMerge(){const me=editing;const q=$('#mgQ');q.value='';
  const paint=()=>{const w=q.value.trim().toLowerCase();const list=contacts.filter(x=>isCo(x)&&x.id!==me.id&&(!w||coNames(x).join(' ').toLowerCase().includes(w)))
      .sort((a,b)=>(fuzzyMatchScore(b,me)-fuzzyMatchScore(a,me))||a.company.localeCompare(b.company,'zh-Hant'));
    $('#mgList').innerHTML=list.map(x=>`<button type="button" class="shrow" data-mg="${x.id}" style="text-align:left">${logoHTML(x,'thumb logo')}<span><b>${esc(x.company)}</b><small>${esc(peopleOf(x).map(p=>p.name).slice(0,3).join('、')||'沒有聯絡人')}・${x.visits.length} 筆紀錄</small></span></button>`).join('')||'<div style="color:var(--sub)">沒有其他公司</div>';wireLogos($('#mgList'))};
  q.oninput=paint;paint();openModal('#mMerge')}
function fuzzyMatchScore(x,me){const a=normCo(x.company),b=normCo(me.company);return a&&b&&(a.includes(b)||b.includes(a))?1:0}
const coPhone=p=>String(p||'').split(/[#＃]|轉|分機|ext/i)[0].trim();
const FREE_MAIL=/(^|\.)(gmail|yahoo|ymail|hotmail|outlook|msn|live|icloud|me|mac|hinet|seed|pchome|kimo|aol|qq|163|126|sina|naver|proton)\./i;
function coDomain(co){const m=String(co.website||'').trim().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/i);
  if(m&&!/(^|\.)(line\.me|facebook\.com|fb\.com|instagram\.com)$/i.test(m[1]))return m[1].toLowerCase();
  for(const p of peopleOf(co)){const d=String(p.email||'').split('@')[1];if(d&&/\./.test(d)&&!FREE_MAIL.test(d))return d.trim().toLowerCase()}
  return ''}
/* logo：用公司網站（或同事 Email 的網域）去找網站圖示；找不到或太小就留白 */
const logoOK=new Map();
const LOGO_GRAD=[['#1F6B4E','#7CCBA4'],['#24587A','#79B4D6'],['#5B4A86','#AE97DA'],['#86562A','#E0AE74'],['#7A3B4B','#D98D9F'],['#2E6964','#93D3C8'],['#4D5E2B','#B5C778'],['#3D4F7A','#9AAEE0']];
function logoBg(co){const n=normCo(co.company)||co.company||'?';let h=0;for(const ch of n)h=(h*31+ch.codePointAt(0))>>>0;const [a,b]=LOGO_GRAD[h%LOGO_GRAD.length];return `background:linear-gradient(135deg,${a},${b})`}
const logoIni=co=>{const n=String(co.company||'').replace(/^(台灣|臺灣|中華|財團法人)/,'').trim();return esc([...n][0]||'?')};
function logoHTML(co,cls){return co.logo?`<div class="${cls} has${co.logoTone?' lg-'+co.logoTone:''}"><img alt="${esc(co.company)} logo" src="${co.logo}"></div>`:`<div class="${cls}" style="${logoBg(co)}"></div>`}
function wireLogos(){}
function fillGaps(co,p){
  if(!co.logo&&!co.logoOff&&p.logo){co.logo=p.logo;co.logoTone=p.logoTone||''}
  for(const k of ['taxId','fax','address','region','brands','status','category'])if(!co[k]&&p[k])co[k]=p[k];
  if(!co.phone&&p.phone)co.phone=coPhone(p.phone);
  if(!co.website&&p.website&&/\./.test(p.website)&&!/line/i.test(p.website))co.website=p.website;
  const have=new Set(co.addresses.map(a=>a.address));if(p.address&&co.address&&p.address!==co.address&&!have.has(p.address)){co.addresses=[...co.addresses,{label:'',address:p.address}];have.add(p.address)}
  co.addresses=[...co.addresses,...(p.addresses||[]).filter(a=>!have.has(a.address)&&a.address!==co.address)];
  co.processes=[...new Set([...co.processes,...(p.processes||[])])];
  if(p.nextFollow&&(!co.nextFollow||p.nextFollow<co.nextFollow))co.nextFollow=p.nextFollow;
  if(!co.region)co.region=findRegion(co.address)||'';
}
function newCoFor(p){const t=(p.taxId||'').replace(/\D/g,'');
  let id='co_'+(validTaxId(t)?'t'+t:hashStr(normCo(p.company)));if(contacts.some(x=>x.id===id))id='co_'+uid();
  return normalize({id,kind:'co',company:(p.company||'').trim(),created:p.created})}
/* 把一個人接到公司：他自己身上的拜訪紀錄搬到公司，跟進日期也交給公司 */
async function linkTo(p,co,noFill){
  co={...co,visits:[...co.visits],addresses:[...co.addresses],processes:[...co.processes]};
  if(!noFill)fillGaps(co,p);
  const moved=p.visits.map(v=>({...v,who:v.who.length?v.who:[p.id],whoN:v.whoN.length?v.whoN:[p.name],photos:(v.photos||[]).map(ph=>ph.o?ph:{...ph,o:p.id})}));
  const ids=new Set(co.visits.map(v=>v.id));co.visits.push(...moved.filter(v=>!ids.has(v.id)));
  co.deletedVisits=(co.deletedVisits||[]).filter(id=>!moved.some(v=>v.id===id));
  await save(co);
  const np={...p,companyId:co.id,company:co.company,visits:[],nextFollow:'',deletedVisits:[...new Set([...(p.deletedVisits||[]),...p.visits.map(v=>v.id)])]};
  await save(np);return [np,co]}
let linking=null,attaching=0;
function linkAll(){if(attaching)return Promise.resolve(0);if(linking)return linking;linking=(async()=>{let n=0;const made=new Map();
  const fresh=co=>co&&(made.get(co.id)||co);
  for(const p0 of contacts.filter(x=>!isCo(x))){const p=contacts.find(x=>x.id===p0.id)||p0;
    const cur=fresh(coOf(p)||(p.companyId&&made.get(p.companyId)));
    try{
      if(cur){if(p.visits.length||p.nextFollow){const [,co]=await linkTo(p,cur);made.set(co.id,co);n++}continue}
      if(!linkable(p))continue;
      let co=fresh(findCo(p.company,p.taxId));
      if(!co){const nc=newCoFor(p);co=made.get(nc.id)||[...made.values()].find(x=>normCo(x.company)===normCo(p.company))||nc}
      const [,saved]=await linkTo(p,co);made.set(saved.id,saved);n++}catch(_){}}
  return n})().finally(()=>{linking=null});return linking}
const needsLink=()=>contacts.some(p=>!isCo(p)&&(coOf(p)?p.visits.length>0:linkable(p)));
async function maybeMigrate(){
  if(!needsLink())return;
  let asked=false;try{asked=!!localStorage.getItem('mpgj.coMigrated')}catch(_){}
  if(!asked){try{localStorage.setItem('mpgj.coMigrated','1')}catch(_){}
    const has=contacts.filter(p=>!isCo(p)&&linkable(p)).length;
    if(has&&await confirmBox(`名片管家改成「以公司為主」了：\n\n• 清單改成一家公司一列，下面小字是這家公司的人\n• 拜訪紀錄和跟進日期記在公司，每筆紀錄可以選這次的窗口\n• 私人（沒有公司）的人照舊記在自己身上\n\n這次會自動把 ${has} 張名片整理到各自的公司。建議先下載一份完整備份再整理。`,{ok:'先下載備份',cancel:'直接整理'})){
      try{await exportJSON(contacts)}catch(_){}}}
  const n=await linkAll();if(n&&!asked){refresh();toast('已整理成以公司為主',3000)}else if(n)refresh();
}

/* ---------- follow-up ---------- */
function followState(c){if(!c.nextFollow)return '';const d=daysBetween(today(),c.nextFollow);return d<0?'od':d<=7?'wk':'ok'}
function followText(c){if(!c.nextFollow)return '';const d=daysBetween(today(),c.nextFollow);return d<0?`逾期 ${-d} 天`:d===0?'今天跟進':d===1?'明天跟進':`${d} 天後`}
const lastVisit=c=>[...c.visits].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];

/* ---------- filtering ---------- */
const S={q:'',cat:'',region:'',proc:'',sort:'follow',follow:'all',sel:null};
const haystack1=c=>[c.name,c.nameEn,c.company,...(c.aka||[]),c.taxId,addrText(c),c.title,c.dept,c.mobile,c.phone,c.email,c.address,c.region,c.website,c.category,c.status,c.processes.join(' '),c.brands,c.metAt,c.notes,...c.visits.map(v=>v.content+' '+v.next+' '+v.other+' '+v.whoN.join(' '))].join(' ').toLowerCase();
const haystack=c=>isCo(c)?[haystack1(c),...peopleOf(c).map(haystack1)].join(' '):haystack1(c);
function filtered(){
  const q=S.q.trim().toLowerCase(),qd=q.replace(/[-\s]/g,'');
  const arr=contacts.filter(isRow).filter(c=>{
    if(S.cat&&c.category!==S.cat)return false;
    if(S.region&&c.region!==S.region)return false;
    if(S.proc&&!c.processes.includes(S.proc))return false;
    const fs=followState(c);
    if(S.follow==='overdue'&&fs!=='od')return false;
    if(S.follow==='week'&&fs!=='wk')return false;
    if(q){const h=haystack(c);const phoneHit=qd.length>=3&&/^\d+$/.test(qd)&&[c.mobile,c.phone,c.fax].some(p=>(p||'').replace(/\D/g,'').includes(qd));
      const ppl=isCo(c)?peopleOf(c):[];const phoneHit2=phoneHit||(qd.length>=3&&/^\d+$/.test(qd)&&ppl.some(p=>[p.mobile,p.phone,p.fax].some(x=>(x||'').replace(/\D/g,'').includes(qd))));
      if(!phoneHit2&&!q.split(/\s+/).filter(Boolean).every(w=>h.includes(w)))return false}
    return true;
  });
  const cmp=(a,b)=>a.localeCompare(b,'zh-Hant');
  return arr.sort((a,b)=>{switch(S.sort){
    case 'updated':return (b.updated||'').localeCompare(a.updated||'');
    case 'company':return cmp(a.company||'~',b.company||'~')||cmp(rowTitle(a),rowTitle(b));
    case 'name':return cmp(rowTitle(a)||'~',rowTitle(b)||'~');
    default:return (a.nextFollow||'9999').localeCompare(b.nextFollow||'9999')||(b.updated||'').localeCompare(a.updated||'')}});
}

/* ---------- render list ---------- */
function renderList(){
  const rows=contacts.filter(isRow);let od=0,wk=0;rows.forEach(c=>{const f=followState(c);if(f==='od')od++;else if(f==='wk')wk++});
  $('#nOd').textContent=od;$('#nWk').textContent=wk;$('#nAll').textContent=rows.length;
  $$('.banner button').forEach(b=>b.classList.toggle('on',b.dataset.f===S.follow&&S.follow!=='all'));
  const used=new Set(contacts.map(c=>c.category).filter(Boolean));
  $('#catChips').innerHTML=['',...CATS.filter(c=>used.has(c)||c===S.cat)].map(c=>`<button class="chip ${S.cat===c?'on':''}" data-cat="${esc(c)}">${c||'全部類別'}</button>`).join('');
  const usedR=[...new Set(contacts.map(c=>c.region).filter(Boolean))].sort((a,b)=>REGIONS.indexOf(a)-REGIONS.indexOf(b));
  $('#fRegion').innerHTML='<option value="">所有地區</option>'+usedR.map(r=>`<option ${S.region===r?'selected':''}>${esc(r)}</option>`).join('');
  const usedP=PROCS.filter(p=>contacts.some(c=>c.processes.includes(p)));
  $('#fProc').innerHTML='<option value="">所有加工</option>'+usedP.map(p=>`<option ${S.proc===p?'selected':''}>${esc(p)}</option>`).join('');
  $('#dlCompany').innerHTML=[...new Set(contacts.filter(c=>isCo(c)||!c.companyId).map(c=>c.company).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('');
  const arr=filtered();
  $('#bFilter').classList.toggle('on',!!(S.region||S.proc||S.sort!=='follow'));
  const nCo=rows.filter(isCo).length,nP=contacts.filter(c=>!isCo(c)).length;
  $('#count').textContent=arr.length===rows.length?`${nCo} 家公司・${nP} 位聯絡人`:`顯示 ${arr.length} ／ ${rows.length} 筆`;
  if(!contacts.length){$('#list').innerHTML=`<div class="empty" style="margin-top:30px"><div class="big">${ic('card')}</div>還沒有名片<br><button class="bigbtn" data-scan>${ic('cam')}拍第一張名片</button></div>`;return}
  if(!arr.length){$('#list').innerHTML=`<div class="empty" style="margin-top:40px">找不到符合條件的名片</div>`;return}
  $('#list').innerHTML='<div class="grp glass">'+arr.map(c=>{const fs=followState(c);
    if(isCo(c)){const ppl=sortPeople(c);const sel=S.sel===c.id||ppl.some(p=>p.id===S.sel);
      return `<div class="item co ${sel?'sel':''}" data-id="${c.id}">
      ${logoHTML(c,'thumb logo')}
      <div class="t"><div class="n">${esc(c.company)}</div>
        <div class="ppl">${ppl.length?ppl.slice(0,2).map(p=>esc(p.name)).join('・')+(ppl.length>2?` +${ppl.length-2}`:''):'（還沒有聯絡人）'}${c.region?' · '+esc(c.region):''}</div></div>
      <div class="r">${fs?`<span class="badge ${fs==='ok'?'':fs}">${fs==='ok'?fmtD(c.nextFollow).slice(5):followText(c)}</span>`:''}${c.category?`<span class="badge cat-${esc(c.category)}">${esc(c.category)}</span>`:''}</div>
      <span class="chev">${ic('chev')}</span>
    </div>`}
    return `<div class="item ${S.sel===c.id?'sel':''}" data-id="${c.id}">
      <div class="thumb" style="${c.thumb?`background-image:url('${c.thumb}')`:''}">${c.thumb?'':esc((c.name||'?').trim().charAt(0))}</div>
      <div class="t"><div class="n">${esc(c.name)}${c.title?` <small>${esc(c.title)}</small>`:''}</div>
        <div class="c">${esc(c.company||'—')}${c.region?' · '+esc(c.region):''}</div></div>
      <div class="r">${fs?`<span class="badge ${fs==='ok'?'':fs}">${fs==='ok'?fmtD(c.nextFollow).slice(5):followText(c)}</span>`:''}${c.category?`<span class="badge cat-${esc(c.category)}">${esc(c.category)}</span>`:''}</div>
      <span class="chev">${ic('chev')}</span>
    </div>`}).join('')+'</div>';
  wireLogos($('#list'));
}

/* ---------- render detail ---------- */
function telLink(p){const n=(p||'').split(/[#＃x轉]/)[0].replace(/[^\d+]/g,'');return n?`<a href="tel:${n}">${esc(p)}</a>`:esc(p)}
let detailToken=0;
/* ---------- 唯讀分享：名片內容壓縮後放在網址 # 後面（# 後面的內容不會傳到任何伺服器），1 天後失效 ---------- */
const SHARE_HOURS=24;
async function packShare(obj){
  const json=new TextEncoder().encode(JSON.stringify(obj));let bytes,tag='z';
  if(typeof CompressionStream==='function'){bytes=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())}
  else{bytes=json;tag='j'}
  let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  return tag+btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
const SH={rec:null};
function personVisits(p){const co=coOf(p);if(!co&&!p.companyId)return p.visits.map(v=>({v,o:p,co:null}));
  const out=[];for(const r of contacts)if(isCo(r))for(const v of r.visits)if(v.who.includes(p.id))out.push({v,o:r,co:r});
  for(const v of p.visits)out.push({v,o:p,co:null});return out}
const byDate=(a,b)=>((b.v||b).date||'').localeCompare(((a.v||a).date||''));
function visitRow(v,co){const r=[v.date||'',v.type||'',v.content||'',v.next||''];const tl=trialLines(v.trial);const w=co?[...v.who.map((id,i)=>{const p=contacts.find(x=>x.id===id);return (p?p.name:v.whoN[i]||'')+(p&&p.companyId!==co.id?'（已離職）':'')}).filter(Boolean),...(v.other?[v.other]:[])].join('、'):'';
  if(tl.length||w)r.push(tl.join('\n'));if(w)r.push(w);return r}
function pickVisits(items,mode){items=[...items].sort(byDate);return mode==='none'?[]:mode==='3'?items.slice(0,3):items}
function personShare(c,o){const co=o.co?coOf(c):null;const g=k=>c[k]||(co&&co[k])||'';
  const d={n:c.name,ne:c.nameEn,co:c.company,ti:c.title,de:c.dept,mo:c.mobile,ph:c.phone,fx:g('fax'),em:c.email,ad:g('address'),
    as:[...c.addresses,...(co?co.addresses:[])].filter(a=>a.address).map(a=>[a.label||'',a.address]),ws:g('website'),tx:g('taxId'),rg:g('region'),
    pr:(co||c).processes,br:(co||c).brands,mt:c.metAt,no:o.notes?c.notes:'',
    v:pickVisits(personVisits(c),o.visits).map(x=>visitRow(x.v,x.co))};
  return d}
function shareData(c,o){o=o||{visits:'all',notes:true,co:true,people:null};let d;
  if(isCo(c)){const ppl=sortPeople(c).filter(p=>!o.people||o.people.includes(p.id));
    d={k:'co',co:c.company,ph:c.phone,fx:c.fax,ad:c.address,as:c.addresses.filter(a=>a.address).map(a=>[a.label||'',a.address]),ws:c.website,tx:c.taxId,rg:c.region,pr:c.processes,br:c.brands,no:o.notes?c.notes:'',
      p:ppl.map(p=>{const r=[p.name,p.title,p.mobile,p.email,p.phone,p.dept,p.nameEn,o.notes?p.notes:''];while(r.length&&!r[r.length-1])r.pop();return r}),
      v:pickVisits(c.visits.map(v=>({v})),o.visits).map(x=>visitRow(x.v,c))}}
  else d=personShare(c,o);
  d.x=Math.floor(Date.now()/1000)+SHARE_HOURS*3600;
  for(const k in d){const v=d[k];if(v===''||v==null||(Array.isArray(v)&&!v.length))delete d[k]}
  return d;
}
function openShare(c){SH.rec=c;const co=isCo(c)?c:coOf(c);
  const row=(attrs,label,sub,on)=>`<label class="shrow"><input type="checkbox" ${attrs} ${on?'checked':''}><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span></label>`;
  const radio=(v,label,on)=>`<label class="shrow"><input type="radio" name="shV" value="${v}" ${on?'checked':''}><span><b>${label}</b></span></label>`;
  const nV=isCo(c)?c.visits.length:personVisits(c).length;
  $('#shTitle').textContent=isCo(c)?'分享公司資料':'分享名片';
  $('#shOpts').innerHTML=(isCo(c)?`<div class="sec" style="border-top:0;padding-top:0">要給對方看哪些人</div>`+sortPeople(c).map(p=>row(`data-shp="${p.id}"`,esc(p.name)+(p.title?` <small style="display:inline">${esc(p.title)}</small>`:''),esc(p.mobile||p.email||''),true)).join('')
      :co?row('id="shCo"','附上公司資料',`${esc(co.company)} 的地址、電話、網站、加工類型`,true):'')
    +`<div class="sec">拜訪紀錄（共 ${nV} 筆）</div>`+radio('3','最近 3 筆',true)+radio('all','全部',false)+radio('none','不附紀錄',false)
    +`<div class="sec">其他</div>`+row('id="shNotes"','附上備註','備註常有內部資訊，傳給客戶前想一下',false)
    +`<div style="color:var(--sub);font-size:13px">產生的連結 1 天內有效，不含照片。</div>`;
  openModal('#mShare')}
async function goShare(){const c=SH.rec;if(!c)return;
  const o={visits:(($('#shOpts [name=shV]:checked')||{}).value)||'3',notes:!!($('#shNotes')||{}).checked,co:!!($('#shCo')||{}).checked,
    people:isCo(c)?$$('#shOpts [data-shp]:checked').map(i=>i.dataset.shp):null};
  closeModal($('#mShare'));await shareCard(c,o)}
async function shareCard(c,o){
  let url;try{url=new URL('view.html',location.href).href+'#'+await packShare(shareData(c,o))}catch(e){toast('產生分享連結失敗');return}
  const title=isCo(c)?`${c.company} 的資料`:`${c.name}${c.company?'｜'+c.company:''} 的名片`;const text=`${title}（連結 1 天內有效）`;
  if(navigator.share){
    try{await navigator.share({title,text,url});return}
    catch(e){if(e&&e.name==='AbortError')return}
  }
  try{await navigator.clipboard.writeText(text+'\n'+url);toast('已複製分享連結，貼到 LINE 就可以（1 天內有效）',3500)}
  catch(_){await infoBox('請長按下面的文字全選後複製，再貼到 LINE（1 天內有效）：',{text:text+'\n'+url,ok:'關閉'})}
}
const yNow0=()=>today().slice(0,4);
function vDateHTML(d){if(!d)return '<b>—</b>';const [y,m,dd]=d.split('-');return `<b>${+dd}</b><small>${+m} 月</small>${y!==yNow0()?`<small>${y}</small>`:''}`}
function visitsHTML(items){
  return `<div class="tl">${items.map(({v,o,co,tag})=>`<div class="v"><div class="vd">${vDateHTML(v.date)}</div><div class="vt" data-vedit="${v.id}" data-o="${o.id}">
      <div class="ty"><span class="badge">${esc(v.type)}</span>${trialResult(v.trial)?`<span class="badge ${resultCls(trialResult(v.trial))}">${esc(trialResult(v.trial))}</span>`:''}${tag?`<span class="badge vco">${esc(tag)}</span>`:''}<span class="sp"></span><button class="x" data-vedit-btn="${v.id}" title="修改這筆" aria-label="修改這筆紀錄">${ic('edit')}</button><button class="x" data-vdel="${v.id}" title="刪除這筆" aria-label="刪除這筆紀錄">${ic('trash')}</button></div>
      ${co?whoHTML(v,co):''}
      ${v.trial?`<div class="tsum">${trialLines(v.trial).map(l=>`<div class="${l.startsWith('★')?'tb':''}">${esc(l)}</div>`).join('')}</div>`:''}
      ${v.content?`<div class="ct">${esc(v.content)}</div>`:''}${v.next?`<div class="nx">→ ${esc(v.next)}</div>`:''}
      <div class="vph">${(v.photos||[]).map(ph=>`<div class="th"><img data-vp="${ph.id}" data-zoom alt="拜訪照片"><button data-vpdel="${ph.id}" data-v="${v.id}" title="刪除這張照片" aria-label="刪除這張照片">${ic('x')}</button></div>`).join('')}<button class="add" data-vpadd="${v.id}" title="加照片">${ic('cam')}加照片</button></div></div></div>`).join('')}</div>`}
const kvRow=(icn,label,val)=>`<div class="kv"><span class="k">${ic(icn)}</span><div style="flex:1;min-width:0"><div class="kl">${label}</div><div class="kvv">${val}</div></div></div>`;
const webLink=w=>/^https?:|^www\./i.test(w)?`<a target="_blank" rel="noopener" href="${esc(/^www\./i.test(w)?'https://'+w:w)}">${esc(w)}</a>`:esc(w);
function followBox(c){const fs=followState(c);return `<div class="follow ${fs}">
      <span class="fi">${ic('clock')}</span>
      <div class="lbl">${c.nextFollow?`下次跟進 <b>${fmtD(c.nextFollow)}</b>・${followText(c)}`:'還沒設定下次跟進日期'}</div>
      ${c.nextFollow?`<button class="btn sm" id="fDone">${ic('check')}已跟進</button>`:''}
      <button class="btn sm" data-snooze="7">+1 週</button><button class="btn sm" data-snooze="30">+1 月</button>
    </div>`}
const tagsHTML=(c,extra)=>{const t=[c.category?`<span class="badge cat-${esc(c.category)}">${esc(c.category)}</span>`:'',c.status?`<span class="badge st-${esc(c.status)}">${esc(c.status)}</span>`:'',extra||''].join('');return t?`<div class="tags">${t}</div>`:''};
const visitsBlock=(n,items,empty)=>`<div class="gh"><span>拜訪／聯絡紀錄・${n} 筆</span><span class="sp"></span><button class="btn sm pri" id="vNew">${ic('plus')}新增紀錄</button></div>
  <div class="dgrp glass vwrap">${items.length?visitsHTML(items):`<div style="color:var(--sub);font-size:14px">${empty}</div>`}</div>`;
function afterDetail(c){document.body.classList.add('detail');const tok=++detailToken;
  $$('#dPhotos img').forEach(async img=>{const src=await Store.getPhoto(c.id,img.dataset.side);if(tok===detailToken&&src)img.src=src});
  $$('#main img[data-vp]').forEach(async img=>{const src=await VP.get(img.dataset.vp);if(tok===detailToken){if(src)img.src=src;else img.alt='同步中…'}});
  wireLogos($('#main'));paintPend()}
function renderDetail(){
  const c=contacts.find(x=>x.id===S.sel);
  if(!c){$('#main').innerHTML=`<div class="empty"><div class="big">${ic('card')}</div>從左邊選一家公司或一個人<br><span style="font-size:13px">或按「拍名片」新增</span></div>`;document.body.classList.remove('detail');return}
  try{if(isCo(c))renderCompany(c);else renderPerson(c)}
  catch(e){document.body.classList.add('detail');$('#main').innerHTML=`<div class="dtop"><button class="nb" id="dBack" aria-label="返回">${ic('back')}</button></div><div class="empty"><div class="big">${ic('note')}</div>這一頁顯示不出來<br><span style="font-size:13px">請截圖給開發的人：${esc((e&&e.message)||e)}</span></div>`}
}
function renderCompany(co){
  const ppl=sortPeople(co),former=formerOf(co);
  const pRow=p=>{const n=visitN(p,co);return `<div class="item pp" data-id="${p.id}"><div class="thumb" style="${p.thumb?`background-image:url('${p.thumb}')`:''}">${p.thumb?'':esc((p.name||'?').trim().charAt(0))}</div>
    <div class="t"><div class="n">${esc(p.name)}${p.title?` <small>${esc(p.title)}</small>`:''}</div><div class="c">${esc(p.mobile||p.phone||p.email||'')}</div></div>
    <div class="r">${n?`<span class="vc">接觸 ${n} 次</span>`:''}</div><span class="chev">${ic('chev')}</span></div>`};
  const gRow=f=>`<div class="item pp gone" ${f.p?`data-id="${f.p.id}"`:''}><div class="thumb">${esc((f.name||'?').charAt(0))}</div>
    <div class="t"><div class="n">${esc(f.name)}<span class="lft">已離職</span></div><div class="c">${f.p&&f.p.company?'現在：'+esc(f.p.company):''}</div></div>
    <div class="r"><span class="vc">接觸 ${visitN({id:f.id},co)} 次</span></div>${f.p?`<span class="chev">${ic('chev')}</span>`:''}</div>`;
  const rows=[
    ['phone','公司電話',co.phone&&telLink(co.phone)],['fax','傳真',co.fax&&esc(co.fax)],
    ['pin','地址',co.address&&`${esc(co.address)}${mapLink(co.address)}`],
    ...co.addresses.map(a=>['factory',esc(a.label||'其他地址'),`${esc(a.address)}${mapLink(a.address)}`]),
    ['link','網站',co.website&&webLink(co.website)],
    ['receipt','統一編號',co.taxId&&esc(co.taxId)+(validTaxId(co.taxId)?'':' <span class="badge od">格式可能有誤</span>')],['map','地區',co.region&&esc(co.region)],
    ['cog','加工類型',co.processes.length&&co.processes.map(p=>`<span class="badge">${esc(p)}</span>`).join(' ')],
    ['tool','刀具品牌',co.brands&&esc(co.brands)],['note','備註',co.notes&&esc(co.notes)]
  ].filter(r=>r[2]);
  const visits=[...co.visits].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(v=>({v,o:co,co}));
  $('#main').innerHTML=`
  <div class="dtop"><button class="nb" id="dBack" aria-label="返回">${ic('back')}</button></div>
  <div class="dcard glass">
    <div class="dhead cohead">${logoHTML(co,'dlogo')}
      <div class="who"><h2>${esc(co.company)}</h2>
        ${co.aka.length?`<div class="co" style="font-size:13px">也叫：${co.aka.map(esc).join('、')}</div>`:''}<div class="co">${[co.region,ppl.length?ppl.length+' 位聯絡人':''].filter(Boolean).map(esc).join(' · ')}</div>${tagsHTML(co)}</div>
    </div>
    ${followBox(co)}
  </div>
  <div class="acts">
    <button class="ab p" id="dEdit"><span>${ic('edit')}</span>編輯公司</button>
    <button class="ab" id="dShare"><span>${ic('share')}</span>分享</button>
    <a class="ab" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(co.company)}"><span>${ic('globe')}</span>查公司</a>
    <button class="ab" id="dAsk"><span>${ic('spark')}</span>拜訪前查詢</button>
  </div>
  <div class="gh"><span>聯絡人・${ppl.length} 位</span><span class="sp"></span><button class="btn sm" id="pNew">${ic('plus')}新增聯絡人</button></div>
  <div class="dgrp glass" style="padding:4px 0">${ppl.map(pRow).join('')||`<div style="color:var(--sub);font-size:14px;padding:12px 16px">還沒有聯絡人</div>`}${former.map(gRow).join('')}</div>
  ${rows.length?`<div class="gh">公司資料</div><div class="dgrp glass">${rows.map(r=>kvRow(r[0],r[1],r[2])).join('')}</div>`:''}
  ${visitsBlock(co.visits.length,visits,'還沒有紀錄。拜訪或聯絡後記一筆，選這次的窗口是誰，下次就知道跟誰聊到哪裡。')}
  <div class="dfoot"><span>建立 ${fmtD((co.created||'').slice(0,10))}・最後更新 ${fmtD((co.updated||'').slice(0,10))}</span><span class="sp"></span><button class="btn sm danger" id="dDel">${ic('trash')}刪除這家公司</button></div>`;
  afterDetail(co);
}
function renderPerson(c){
  const co=coOf(c);
  const rows=[
    ['mobile','手機',c.mobile&&telLink(c.mobile)],['phone','公司電話',c.phone&&telLink(c.phone)],['fax','傳真',c.fax&&esc(c.fax)],
    ['mail','Email',c.email&&`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
    ['pin','地址',c.address&&`${esc(c.address)}${mapLink(c.address)}`],
    ...c.addresses.map(a=>['factory',esc(a.label||'其他地址'),`${esc(a.address)}${mapLink(a.address)}`]),
    ['link','網站／LINE',c.website&&webLink(c.website)],
    ['receipt','統一編號',!co&&c.taxId&&esc(c.taxId)+(validTaxId(c.taxId)?'':' <span class="badge od">格式可能有誤</span>')],['building','部門',c.dept&&esc(c.dept)],['map','地區',!co&&c.region&&esc(c.region)],
    ['cog','加工類型',!co&&c.processes.length&&c.processes.map(p=>`<span class="badge">${esc(p)}</span>`).join(' ')],
    ['tool','刀具品牌',!co&&c.brands&&esc(c.brands)],['users','認識情境',c.metAt&&esc(c.metAt)],['note','備註',c.notes&&esc(c.notes)]
  ].filter(r=>r[2]);
  const items=personVisits(c).sort(byDate).map(x=>({...x,tag:co&&x.co&&x.co.id!==co.id?x.co.company:(!co&&x.co?x.co.company:'')}));
  $('#main').innerHTML=`
  <div class="dtop"><button class="nb" id="dBack" aria-label="返回">${ic('back')}</button></div>
  <div class="dcard glass">
    <div class="dhead">
      <div class="who">
        <h2>${esc(c.name)}${c.nameEn?`<span class="en">${esc(c.nameEn)}</span>`:''}</h2>
        <div class="co">${co?`<button class="colink" data-go="${co.id}" title="打開公司頁">${ic('building')}<span>${esc(co.company)}</span>${ic('chev')}</button>`:esc(c.company||'')}${c.title?' · '+esc(c.title):''}</div>
        ${tagsHTML(co?{}:c)}
      </div>
      <div class="photos" id="dPhotos">${['front','back'].filter(s=>c['has'+(s==='front'?'Front':'Back')]).map(s=>`<img data-zoom data-side="${s}" alt="名片${s==='front'?'正面':'背面'}" ${s==='front'&&c.thumb?`src="${c.thumb}"`:''}>`).join('')}</div>
    </div>
    ${co?'':followBox(c)}
  </div>
  <div class="acts">
    <button class="ab p" id="dEdit"><span>${ic('edit')}</span>編輯</button>
    <button class="ab" id="dShare"><span>${ic('share')}</span>分享</button>
    ${co?`<button class="ab" data-go="${co.id}"><span>${ic('building')}</span>公司頁</button>`:`<a class="ab" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(c.company||c.name)}"><span>${ic('globe')}</span>查公司</a>`}
    <button class="ab" id="dAsk"><span>${ic('spark')}</span>拜訪前查詢</button>
  </div>
  ${rows.length?`<div class="gh">詳細資料</div><div class="dgrp glass">${rows.map(r=>kvRow(r[0],r[1],r[2])).join('')}</div>`:''}
  ${visitsBlock(items.length,items,co?`還沒有跟${esc(c.name)}有關的紀錄。新增的紀錄會記在「${esc(co.company)}」，窗口選${esc(c.name)}。`:'還沒有紀錄。見面或聯絡後記一筆，下次就知道聊到哪裡。')}
  <div class="dfoot"><span>建立 ${fmtD((c.created||'').slice(0,10))}・最後更新 ${fmtD((c.updated||'').slice(0,10))}</span><span class="sp"></span><button class="btn sm danger" id="dDel">${ic('trash')}刪除這張名片</button></div>`;
  afterDetail(c);
}
const isNarrow=()=>window.innerWidth<=820;
let navDepth=0,afterPop=null;
function resetSwipe(){document.body.classList.remove('peek');for(const el of [$('#main'),$('.side')]){if(el){el.style.transition='';el.style.transform='';el.style.opacity=''}}}
function select(id){resetSwipe();const was=S.sel;S.sel=id;renderList();renderDetail();$('#main').scrollTop=0;
  if(isNarrow()){window.scrollTo(0,0);const inDetail=history.state&&history.state.detail;if(!was||!inDetail){navDepth=0;history.pushState({detail:id},'')}else if(was!==id){navDepth++;history.pushState({detail:id},'')}}}
function closeDetail(){resetSwipe();S.sel=null;navDepth=0;document.body.classList.remove('detail');renderList()}
function goBack(){if(history.state&&history.state.detail)history.back();else closeDetail()}
let skipPop=0;
addEventListener('popstate',()=>{if(skipPop){skipPop--;return}
  const open=$$('.modal.on');
  if(open.length){const m=open[open.length-1];const c=m.querySelector('[data-close]');if(c)c.click();else closeModal(m,true);
    setTimeout(()=>{if(m.classList.contains('on')&&isNarrow())history.pushState({modal:m.id},'')},300);return}
  const st=history.state&&history.state.detail;
  if(st&&!contacts.some(c=>c.id===st)){if(S.sel)closeDetail();return}
  if(st&&st!==S.sel){navDepth=Math.max(0,navDepth-1);S.sel=st;renderList();renderDetail();$('#main').scrollTop=0;if(afterPop){const f=afterPop;afterPop=null;f()}return}
  if(S.sel&&!st)closeDetail()});
/* swipe right to go back (phone) — iOS 式互動轉場：詳細頁跟著手指走，清單從左邊稍微滑入並變亮 */
(()=>{let x0=0,y0=0,t0=0,dx=0,lastX=0,lastT=0,vx=0,active=false,locked=null,W=0;
  const main=()=>$('#main'),side=()=>$('.side'),EASE='cubic-bezier(.2,.8,.2,1)';
  const paint=x=>{const p=Math.min(Math.max(x/W,0),1);main().style.transform=`translate3d(${x}px,0,0)`;
    side().style.transform=`translate3d(${-30*(1-p)}%,0,0)`;side().style.opacity=String(.55+.45*p)};
  const clean=()=>{const m=main(),sd=side();for(const el of [m,sd]){el.style.transition='';el.style.transform='';el.style.opacity=''}document.body.classList.remove('peek')};
  document.addEventListener('touchstart',e=>{active=false;if(!isNarrow()||!document.body.classList.contains('detail')||$$('.modal.on').length||$('#dlg.on')||e.touches.length!==1)return;
    const t=e.touches[0];if(t.clientX<24)return; // 螢幕最左邊交給 iPhone 系統自己的返回手勢
    if(e.target.closest('input,textarea,select'))return;x0=lastX=t.clientX;y0=t.clientY;t0=lastT=e.timeStamp;dx=0;vx=0;active=true;locked=null;W=window.innerWidth},{passive:true});
  document.addEventListener('touchmove',e=>{if(!active)return;const t=e.touches[0];const mx=t.clientX-x0,my=t.clientY-y0;
    if(locked===null&&(Math.abs(mx)>10||Math.abs(my)>10)){locked=Math.abs(mx)>Math.abs(my)*1.2&&mx>0?'h':'v';
      if(locked==='h'){document.body.classList.add('peek');main().style.transition='none';side().style.transition='none'}}
    if(locked!=='h')return;
    const dt=e.timeStamp-lastT;if(dt>0)vx=.8*((t.clientX-lastX)/dt)+.2*vx;lastX=t.clientX;lastT=e.timeStamp;
    dx=Math.max(0,mx);paint(dx)},{passive:true});
  const end=()=>{if(!active)return;active=false;if(locked!=='h')return;
    const done=dx>W*.4||(vx>.35&&dx>20);const ms=Math.round(Math.max(160,Math.min(320,(done?W-dx:dx)/Math.max(Math.abs(vx),.9))));
    for(const el of [main(),side()])el.style.transition=`transform ${ms}ms ${EASE},opacity ${ms}ms ${EASE}`;
    requestAnimationFrame(()=>paint(done?W:0));
    setTimeout(()=>{if(done){if(navDepth>0&&history.state&&history.state.detail){afterPop=clean;history.back();setTimeout(()=>{if(afterPop){afterPop=null;clean()}},600)}else{closeDetail();clean();if(history.state&&history.state.detail)history.back()}}else clean()},ms+20)};
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
})();
/* swipe right to close a full-screen sheet (phone) — iOS 式：整頁跟著手指走，後面的畫面慢慢露出來 */
(()=>{let x0=0,y0=0,dx=0,lastX=0,lastT=0,vx=0,box=null,modal=null,locked=null,W=0;const EASE='cubic-bezier(.2,.8,.2,1)';
  const paint=x=>{const p=Math.min(Math.max(x/W,0),1);box.style.transform=`translate3d(${x}px,0,0)`;modal.style.background=`rgba(0,0,0,${(.45*(1-p)).toFixed(3)})`};
  const clean=(b,m)=>{b.style.transition=b.style.transform=b.style.boxShadow='';m.style.transition=m.style.background=''};
  document.addEventListener('touchstart',e=>{box=null;if(!isNarrow()||e.touches.length!==1||$('#dlg.on'))return;
    const m=[...$$('.modal.on')].pop();if(!m)return;const t=e.touches[0];
    if(t.clientX<24)return; // 最左邊交給 iPhone 系統手勢（會關掉這一頁）
    if(e.target.closest('input,textarea,select,.btable,.chips,.cut'))return;
    x0=lastX=t.clientX;y0=t.clientY;lastT=e.timeStamp;dx=0;vx=0;locked=null;modal=m;box=m.querySelector('.mbox');W=window.innerWidth},{passive:true});
  document.addEventListener('touchmove',e=>{if(!box)return;const t=e.touches[0];const mx=t.clientX-x0,my=t.clientY-y0;
    if(locked===null&&(Math.abs(mx)>10||Math.abs(my)>10)){locked=Math.abs(mx)>Math.abs(my)*1.2&&mx>0?'h':'v';
      if(locked==='h'){box.style.transition='none';modal.style.transition='none';box.style.boxShadow='-12px 0 32px rgba(0,0,0,.4)'}}
    if(locked!=='h')return;const dt=e.timeStamp-lastT;if(dt>0)vx=.8*((t.clientX-lastX)/dt)+.2*vx;lastX=t.clientX;lastT=e.timeStamp;
    dx=Math.max(0,mx);paint(dx)},{passive:true});
  const end=()=>{const b=box,m=modal;box=null;if(!b||locked!=='h')return;
    const done=dx>W*.4||(vx>.35&&dx>20);const ms=Math.round(Math.max(160,Math.min(320,(done?W-dx:dx)/Math.max(Math.abs(vx),.9))));
    b.style.transition=`transform ${ms}ms ${EASE}`;m.style.transition=`background ${ms}ms ${EASE}`;box=b;modal=m;requestAnimationFrame(()=>{paint(done?W:0);box=null});
    setTimeout(()=>{if(done){const c=m.querySelector('[data-close]');m.style.visibility='hidden';if(c)c.click();else closeModal(m);
      requestAnimationFrame(()=>{clean(b,m);m.style.visibility=''})}else clean(b,m)},ms+20)};
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
})();
function refresh(){renderList();renderDetail()}
