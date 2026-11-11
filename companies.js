/* 名片管家：公司與聯絡人、清單、詳細頁、返回手勢 */
'use strict';
/* ---------- 公司與聯絡人 ----------
   公司也是一筆資料（kind:'co'），聯絡人用 companyId 連到公司。
   拜訪紀錄記在公司上，每筆用 who 記下這次的窗口；保險類別（或沒有公司）的人，紀錄和跟進記在自己身上。 */
const isCo=c=>!!c&&c.kind==='co';
const coOf=p=>p&&p.companyId?contacts.find(x=>x.id===p.companyId&&isCo(x))||null:null;
const peopleOf=co=>contacts.filter(p=>!isCo(p)&&p.companyId===co.id);
const linkable=p=>!isCo(p)&&!!(p.company||'').trim()&&p.category!==INS_CAT;
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
  if(from.nextFollow&&(!t.nextFollow||from.nextFollow<t.nextFollow)){t.nextFollow=from.nextFollow;t.followTime=from.followTime||''}
  t.aka=[...new Set([...t.aka,...coNames(from)])].filter(x=>x!==t.company);
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
/* 公司圖示：用公司名稱算出一個固定的彩色漸層（不再從名片剪 logo） */
const LOGO_GRAD=[['#1F6B4E','#7CCBA4'],['#24587A','#79B4D6'],['#5B4A86','#AE97DA'],['#86562A','#E0AE74'],['#7A3B4B','#D98D9F'],['#2E6964','#93D3C8'],['#4D5E2B','#B5C778'],['#3D4F7A','#9AAEE0']];
function logoBg(co){const n=normCo(co.company)||co.company||'?';let h=0;for(const ch of n)h=(h*31+ch.codePointAt(0))>>>0;const [a,b]=LOGO_GRAD[h%LOGO_GRAD.length];return `background:linear-gradient(135deg,${a},${b})`}
const logoIni=co=>{const n=String(co.company||'').replace(/^(台灣|臺灣|中華|財團法人)/,'').trim();return esc([...n][0]||'?')};
function logoHTML(co,cls){return `<div class="${cls}" style="${logoBg(co)}"></div>`}
function wireLogos(){}
/* 首頁公司那一列：用這家公司聯絡人的名片縮圖（照接觸次數、職稱排第一個有名片照片的人）；都沒有照片才用色塊 */
function coThumb(co,ppl){const p=(ppl||sortPeople(co)).find(x=>x.thumb);return p?`<div class="thumb" style="background-image:url('${p.thumb}')"></div>`:logoHTML(co,'thumb logo')}
function fillGaps(co,p){
  for(const k of ['taxId','fax','address','region','brands','status','category'])if(!co[k]&&p[k])co[k]=p[k];
  if(!co.phone&&p.phone)co.phone=coPhone(p.phone);
  if(!co.website&&p.website&&/\./.test(p.website)&&!/line/i.test(p.website))co.website=p.website;
  const have=new Set(co.addresses.map(a=>a.address));if(p.address&&co.address&&p.address!==co.address&&!have.has(p.address)){co.addresses=[...co.addresses,{label:'',address:p.address}];have.add(p.address)}
  co.addresses=[...co.addresses,...(p.addresses||[]).filter(a=>!have.has(a.address)&&a.address!==co.address)];
  co.processes=[...new Set([...co.processes,...(p.processes||[])])];
  if(p.nextFollow&&(!co.nextFollow||p.nextFollow<co.nextFollow)){co.nextFollow=p.nextFollow;co.followTime=p.followTime||''}
  if(!co.region)co.region=findRegion(co.address)||'';
}
function newCoFor(p){const t=(p.taxId||'').replace(/\D/g,'');
  let id='co_'+(validTaxId(t)?'t'+t:hashStr(normCo(p.company)));if(contacts.some(x=>x.id===id))id='co_'+uid();
  return normalize({id,kind:'co',company:(p.company||'').trim(),created:p.created})}
/* 把一個人接到公司：他自己身上的拜訪紀錄搬到公司，跟進日期也交給公司 */
async function linkTo(p,co,noFill){
  co={...co,visits:[...co.visits],addresses:[...co.addresses],processes:[...co.processes]};
  if(!noFill)fillGaps(co,p);
  const keepIns=hasIns(p);const mv=p.visits.filter(v=>!v.ins),stay=p.visits.filter(v=>v.ins);
  const moved=mv.map(v=>({...v,who:v.who.length?v.who:[p.id],whoN:v.whoN.length?v.whoN:[p.name],photos:(v.photos||[]).map(ph=>ph.o?ph:{...ph,o:p.id})}));
  const ids=new Set(co.visits.map(v=>v.id));co.visits.push(...moved.filter(v=>!ids.has(v.id)));
  co.deletedVisits=(co.deletedVisits||[]).filter(id=>!moved.some(v=>v.id===id));
  await save(co);
  const np={...p,companyId:co.id,company:co.company,visits:stay,nextFollow:keepIns?p.nextFollow:'',followTime:keepIns?p.followTime||'':'',deletedVisits:[...new Set([...(p.deletedVisits||[]),...mv.map(v=>v.id)])]};
  await save(np);return [np,co]}
let linking=null,attaching=0;
function linkAll(){if(attaching)return Promise.resolve(0);if(linking)return linking;linking=(async()=>{let n=0;const made=new Map();
  const fresh=co=>co&&(made.get(co.id)||co);
  for(const p0 of contacts.filter(x=>!isCo(x))){const p=contacts.find(x=>x.id===p0.id)||p0;
    const cur=fresh(coOf(p)||(p.companyId&&made.get(p.companyId)));
    try{
      if(cur){if(p.visits.some(v=>!v.ins)||(p.nextFollow&&!hasIns(p))){const [,co]=await linkTo(p,cur);made.set(co.id,co);n++}continue}
      if(!linkable(p))continue;
      let co=fresh(findCo(p.company,p.taxId));
      if(!co){const nc=newCoFor(p);co=made.get(nc.id)||[...made.values()].find(x=>normCo(x.company)===normCo(p.company))||nc}
      const [,saved]=await linkTo(p,co);made.set(saved.id,saved);n++}catch(_){}}
  return n})().finally(()=>{linking=null});return linking}
const needsLink=()=>contacts.some(p=>!isCo(p)&&(coOf(p)?p.visits.some(v=>!v.ins):linkable(p)));
async function maybeMigrate(){
  if(!needsLink())return;
  let asked=false;try{asked=!!localStorage.getItem('mpgj.coMigrated')}catch(_){}
  if(!asked){try{localStorage.setItem('mpgj.coMigrated','1')}catch(_){}
    const has=contacts.filter(p=>!isCo(p)&&linkable(p)).length;
    if(has&&await confirmBox(`名片管家改成「以公司為主」了：\n\n• 清單改成一家公司一列，下面小字是這家公司的人\n• 拜訪紀錄和跟進日期記在公司，每筆紀錄可以選這次的窗口\n• 保險類別（或沒有公司）的人照舊記在自己身上\n\n這次會自動把 ${has} 張名片整理到各自的公司。建議先下載一份完整備份再整理。`,{ok:'先下載備份',cancel:'直接整理'})){
      try{await exportJSON(contacts)}catch(_){}}}
  const n=await linkAll();if(n&&!asked){refresh();toast('已整理成以公司為主',3000)}else if(n)refresh();
}

/* ---------- follow-up ---------- */
function followState(c){if(!c.nextFollow)return '';const d=daysBetween(today(),c.nextFollow);return d<0?'od':d<=7?'wk':'ok'}
function followText(c){if(!c.nextFollow)return '';const d=daysBetween(today(),c.nextFollow);return d<0?`逾期 ${-d} 天`:d===0?'今天跟進':d===1?'明天跟進':`${d} 天後`}
// 列表徽章：有填時間就顯示「今天 14:30」「明天 09:00」「11/20 14:30」
function followBadge(c){const fs=followState(c),t=c.followTime;if(fs==='ok')return fmtD(c.nextFollow).slice(5)+(t?' '+t:'');if(!t||fs==='od')return followText(c);const d=daysBetween(today(),c.nextFollow);return (d===0?'今天':d===1?'明天':fmtD(c.nextFollow).slice(5))+' '+t}
const lastVisit=c=>[...c.visits].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];

/* ---------- 保險到期 ---------- */
const isIns=c=>!isCo(c)&&hasIns(c);
/* 這個人最快到期的那台車（已過期的也算），沒有就回傳 null */
function insNext(c){if(!isIns(c))return null;let best=null;for(const x of c.cars||[])if(x.exp&&(!best||x.exp<best.exp))best=x;return best}
/* 符合目前「保險到期」篩選的那台車（好幾台都符合時取最早的） */
function insMatch(c){if(!isIns(c)||!S.ins)return null;let best=null;
  for(const x of c.cars||[]){if(!x.exp)continue;const d=daysBetween(today(),x.exp);if(S.ins==='od'?d>=0:(d<0||d>+S.ins))continue;if(!best||x.exp<best.exp)best=x}return best}
const insDays=x=>x&&x.exp?daysBetween(today(),x.exp):null;
const insText=d=>d<0?`已過期 ${-d} 天`:d===0?'今天到期':`${d} 天後到期`;
const insCls=d=>d==null?'':d<0?'od':d<=30?'wk':'';
const INS_RANGES=[['','全部'],['od','已過期'],['30','30 天內到期'],['60','60 天內到期'],['90','90 天內到期']];
/* 生日 */
function bdText(c){const b=bdParts(c.birthday);if(!b)return '';const t=new Date(today()+'T00:00:00');let y=t.getFullYear();
  const next=yy=>{const d=new Date(yy,b.m-1,b.m===2&&b.d===29&&new Date(yy,1,29).getMonth()!==1?28:b.d);return d};
  let n=next(y);if(n<t)n=next(++y);const dd=Math.round((n-t)/864e5);
  return `${b.y?b.y+' 年 ':''}${b.m} 月 ${b.d} 日${b.y?`（${y-b.y} 歲${dd?'生日':''}）`:''}・${dd===0?'就是今天':`還有 ${dd} 天`}`}

/* ---------- filtering ---------- */
/* 清單有哪些列：一般是公司＋沒公司的人；點「保險」時是所有有保險往來的人（在公司上班的也單獨列出來）；
   看逾期、7 天內時，在公司上班、有保險跟進日期的人也列出來 */
const insFollowP=c=>!isCo(c)&&!isRow(c)&&hasIns(c)&&!!c.nextFollow;
function listBase(){if(S.cat===INS_CAT)return contacts.filter(c=>!isCo(c)&&hasIns(c));
  return contacts.filter(c=>isRow(c)||(S.follow!=='all'&&insFollowP(c)))}
const S={q:'',cat:'',region:'',proc:'',sort:'updated',sortPrev:null,follow:'all',sel:null,ins:''};
const haystack1=c=>[c.name,c.nameEn,c.company,...(c.aka||[]),c.taxId,addrText(c),c.title,c.dept,c.mobile,c.phone,c.email,c.address,c.region,c.website,c.category,c.status,c.processes.join(' '),c.brands,c.metAt,c.notes,...(c.cars||[]).map(x=>x.plate+' '+x.plate.replace(/-/g,'')),...c.visits.map(v=>v.content+' '+v.next+' '+v.other+' '+v.whoN.join(' '))].join(' ').toLowerCase();
const haystack=c=>isCo(c)?[haystack1(c),...peopleOf(c).map(haystack1)].join(' '):haystack1(c);
function filtered(){
  const q=S.q.trim().toLowerCase(),qd=q.replace(/[-\s]/g,'');
  const insView=S.cat===INS_CAT;
  const arr=listBase().filter(c=>{
    if(S.cat&&!insView&&c.category!==S.cat)return false;
    if(S.region&&c.region!==S.region)return false;
    if(S.proc&&!c.processes.includes(S.proc))return false;
    if(S.ins&&S.cat===INS_CAT&&!insMatch(c))return false;
    const fs=followState(c);
    if(S.follow==='overdue'&&fs!=='od')return false;
    if(S.follow==='week'&&fs!=='wk')return false;
    if(q){const h=haystack(c);const phoneHit=qd.length>=3&&/^\d+$/.test(qd)&&[c.mobile,c.phone,c.fax].some(p=>(p||'').replace(/\D/g,'').includes(qd));
      const ppl=isCo(c)?peopleOf(c):[];const phoneHit2=phoneHit||(qd.length>=3&&/^\d+$/.test(qd)&&ppl.some(p=>[p.mobile,p.phone,p.fax].some(x=>(x||'').replace(/\D/g,'').includes(qd))));
      if(!phoneHit2&&!q.split(/\s+/).filter(Boolean).every(w=>h.includes(w)))return false}
    return true;
  });
  const cmp=(a,b)=>a.localeCompare(b,'zh-Hant');
  if(S.ins&&S.cat===INS_CAT)return arr.sort((a,b)=>insMatch(a).exp.localeCompare(insMatch(b).exp));
  // 公司那一列的「最近更新」：公司本身或底下任何一位聯絡人最後修改的時間
  const upd=new Map();const rowUpd=c=>{if(!upd.has(c.id))upd.set(c.id,isCo(c)?[c.updated||'',...peopleOf(c).map(p=>p.updated||'')].sort().pop():c.updated||'');return upd.get(c.id)};
  return arr.sort((a,b)=>{switch(S.sort){
    case 'updated':return rowUpd(b).localeCompare(rowUpd(a));
    case 'company':return cmp(a.company||'~',b.company||'~')||cmp(rowTitle(a),rowTitle(b));
    case 'name':return cmp(rowTitle(a)||'~',rowTitle(b)||'~');
    default:return (a.nextFollow||'9999').localeCompare(b.nextFollow||'9999')||(a.followTime||'99').localeCompare(b.followTime||'99')||(b.updated||'').localeCompare(a.updated||'')}});
}

/* ---------- render list ---------- */
/* 清單上：保險 60 天內到期（或已過期）才顯示，篩選保險到期時一定顯示 */
function insBadge(c){const x=(S.ins&&S.cat===INS_CAT&&insMatch(c))||insNext(c),d=insDays(x);if(d==null||(d>60&&!(S.ins&&S.cat===INS_CAT)))return '';return `<span class="badge ${insCls(d)}" title="${esc(x.plate)}">${ic('car')}${d<0?'保險過期':d===0?'保險今天到期':`保險 ${d} 天`}</span>`}
let listReuse=null,listVer=0,catPrebuild=null;   // 左右滑換類別時，直接搬用已經準備好的那頁，不用重新產生
function listHTML(arr){
  if(!contacts.length)return `<div class="empty" style="margin-top:30px"><div class="big">${ic('card')}</div>還沒有名片<br><button class="bigbtn" data-scan>${ic('cam')}拍第一張名片</button></div>`;
  if(!arr.length)return `<div class="empty" style="margin-top:40px">找不到符合條件的名片</div>`;
  return '<div class="grp glass">'+arr.map(c=>{const fs=followState(c);
    if(isCo(c)){const ppl=sortPeople(c);const sel=S.sel===c.id||ppl.some(p=>p.id===S.sel);
      return `<div class="item co ${sel?'sel':''}" data-id="${c.id}">
      ${coThumb(c,ppl)}
      <div class="t"><div class="n">${esc(c.company)}</div>
        <div class="ppl">${ppl.length?ppl.slice(0,2).map(p=>esc(p.name)).join('・')+(ppl.length>2?` +${ppl.length-2}`:''):'（還沒有聯絡人）'}${c.region?' · '+esc(c.region):''}</div></div>
      <div class="r">${fs?`<span class="badge ${fs==='ok'?'':fs}">${followBadge(c)}</span>`:''}${c.category?`<span class="badge ${optCls('cat',c.category)}">${esc(c.category)}</span>`:''}</div>
      <span class="chev">${ic('chev')}</span>
    </div>`}
    return `<div class="item ${S.sel===c.id?'sel':''}" data-id="${c.id}">
      <div class="thumb" style="${c.thumb?`background-image:url('${c.thumb}')`:''}">${c.thumb?'':esc((c.name||'?').trim().charAt(0))}</div>
      <div class="t"><div class="n">${esc(c.name)}${c.title?` <small>${esc(c.title)}</small>`:''}${hasIns(c)&&!insOnly(c)?`<span class="insic" title="也有保險往來">${ic('car')}</span>`:''}</div>
        <div class="c">${esc(c.company||'—')}${c.region?' · '+esc(c.region):''}</div></div>
      <div class="r">${fs?`<span class="badge ${fs==='ok'?'':fs}">${followBadge(c)}</span>`:''}${insBadge(c)}${c.category?`<span class="badge ${optCls('cat',c.category)}">${esc(c.category)}</span>`:''}</div>
      <span class="chev">${ic('chev')}</span>
    </div>`}).join('')+'</div>';
}
function renderList(){
  const rows=contacts.filter(isRow);let od=0,wk=0;[...rows,...contacts.filter(insFollowP)].forEach(c=>{const f=followState(c);if(f==='od')od++;else if(f==='wk')wk++});
  $('#nOd').textContent=od;$('#nWk').textContent=wk;$('#nAll').textContent=rows.length;
  $$('.banner button').forEach(b=>b.classList.toggle('on',b.dataset.f===S.follow&&S.follow!=='all'));
  const used=new Set(contacts.map(c=>c.category).filter(Boolean));if(contacts.some(hasIns))used.add(INS_CAT);
  {const cs=['',...optWith('cat',[...used]).filter(c=>used.has(c)||c===S.cat)],box=$('#catChips'),key=cs.join('\u0001');
    if(box.dataset.k===key)box.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('on',b.dataset.cat===S.cat));
    else{box.innerHTML=cs.map(c=>`<button class="chip ${S.cat===c?'on':''}" data-cat="${esc(c)}">${c?esc(c):'全部類別'}</button>`).join('');box.dataset.k=key}
    paintGlass()}
  {const box=$('#insRow');const on=S.cat===INS_CAT;box.hidden=!on;
    if(on)box.innerHTML=`<span class="il">${ic('car')}保險到期</span>`+INS_RANGES.map(([v,t])=>`<button class="chip sm ${S.ins===v?'on':''}" data-ins="${v}">${t}</button>`).join('')}
  const usedR=[...new Set(contacts.map(c=>c.region).filter(Boolean))].sort((a,b)=>{const o=optWith('region',[a,b]);return o.indexOf(a)-o.indexOf(b)});
  $('#fRegion').innerHTML='<option value="">所有地區</option>'+usedR.map(r=>`<option ${S.region===r?'selected':''}>${esc(r)}</option>`).join('');
  const usedP=optWith('proc',contacts.flatMap(c=>c.processes)).filter(p=>contacts.some(c=>c.processes.includes(p)));
  $('#fProc').innerHTML='<option value="">所有加工</option>'+usedP.map(p=>`<option ${S.proc===p?'selected':''}>${esc(p)}</option>`).join('');
  $('#dlCompany').innerHTML=[...new Set(contacts.filter(c=>isCo(c)||!c.companyId).map(c=>c.company).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('');
  const arr=filtered();
  $('#bFilter').classList.toggle('on',!!(S.region||S.proc||S.sort!=='updated'));
  const nCo=rows.filter(isCo).length,nP=contacts.filter(c=>!isCo(c)).length;
  $('#count').textContent=arr.length===rows.length?`${nCo} 家公司・${nP} 位聯絡人`:`顯示 ${arr.length} ／ ${rows.length} 筆`;
  if(listReuse){$('#list').replaceChildren(...listReuse.childNodes);listReuse=null}else $('#list').innerHTML=listHTML(arr);
  listVer++;if(typeof catPrebuild==='function')catPrebuild();
  wireLogos($('#list'));
}

/* ---------- render detail ---------- */
function telLink(p){const n=(p||'').split(/[#＃x轉]/)[0].replace(/[^\d+]/g,'');return n?`<a href="tel:${n}">${esc(p)}</a>`:esc(p)}
let detailToken=0;
function personVisits(p){const co=coOf(p);if(!co&&!p.companyId)return p.visits.map(v=>({v,o:p,co:null}));
  const out=[];for(const r of contacts)if(isCo(r))for(const v of r.visits)if(v.who.includes(p.id))out.push({v,o:r,co:r});
  for(const v of p.visits)out.push({v,o:p,co:null});return out}
const byDate=(a,b)=>((b.v||b).date||'').localeCompare(((a.v||a).date||''));
const yNow0=()=>today().slice(0,4);
function vDateHTML(d){if(!d)return '<b>—</b>';const [y,m,dd]=d.split('-');return `<b>${+dd}</b><small>${+m} 月</small>${y!==yNow0()?`<small>${y}</small>`:''}`}
function visitsHTML(items){
  return `<div class="tl">${items.map(({v,o,co,tag})=>`<div class="v"><div class="vd">${vDateHTML(v.date)}</div><div class="vt" data-vedit="${v.id}" data-o="${o.id}">
      <div class="ty"><span class="badge">${esc(v.type)}</span>${v.ins?`<span class="badge c-purple">保險</span>`:''}${trialResult(v.trial)?`<span class="badge ${resultCls(trialResult(v.trial))}">${esc(trialResult(v.trial))}</span>`:''}${tag?`<span class="badge vco">${esc(tag)}</span>`:''}<span class="sp"></span><button class="x" data-vedit-btn="${v.id}" title="修改這筆" aria-label="修改這筆紀錄">${ic('edit')}</button><button class="x" data-vdel="${v.id}" title="刪除這筆" aria-label="刪除這筆紀錄">${ic('trash')}</button></div>
      ${co?whoHTML(v,co):''}
      ${v.trial?`<div class="tsum">${trialLines(v.trial).map(l=>`<div class="${l.startsWith('★')?'tb':''}">${esc(l)}</div>`).join('')}</div>`:''}
      ${v.content?`<div class="ct">${esc(v.content)}</div>`:''}${v.next?`<div class="nx">→ ${esc(v.next)}</div>`:''}
      <div class="vph">${(v.photos||[]).map(ph=>`<div class="th"><img data-vp="${ph.id}" data-zoom alt="拜訪照片"><button data-vpdel="${ph.id}" data-v="${v.id}" title="刪除這張照片" aria-label="刪除這張照片">${ic('x')}</button></div>`).join('')}<button class="add" data-vpadd="${v.id}" title="加照片">${ic('cam')}加照片</button></div></div></div>`).join('')}</div>`}
const kvRow=(icn,label,val)=>`<div class="kv"><span class="k">${ic(icn)}</span><div style="flex:1;min-width:0"><div class="kl">${label}</div><div class="kvv">${val}</div></div></div>`;
const webLink=w=>/^https?:|^www\./i.test(w)?`<a target="_blank" rel="noopener" href="${esc(/^www\./i.test(w)?'https://'+w:w)}">${esc(w)}</a>`:esc(w);
function followBox(c,label){const fs=followState(c);return `<div class="follow ${fs}">
      <span class="fi">${ic('clock')}</span>
      <div class="lbl">${c.nextFollow?`${label||'下次跟進'} <b>${fmtD(c.nextFollow)}${c.followTime?' '+c.followTime:''}</b>・${followText(c)}`:'還沒設定下次跟進日期'}</div>
      ${c.nextFollow?`<button class="btn sm" id="fDone">${ic('check')}已跟進</button>`:''}
      <button class="btn sm" data-snooze="7">+1 週</button><button class="btn sm" data-snooze="30">+1 月</button>
    </div>`}
const tagsHTML=(c,extra)=>{const t=[c.category?`<span class="badge ${optCls('cat',c.category)}">${esc(c.category)}</span>`:'',c.status?`<span class="badge ${optCls('status',c.status)}">${esc(c.status)}</span>`:'',extra||''].join('');return t?`<div class="tags">${t}</div>`:''};
const visitsBlock=(n,items,empty,insBtn)=>`<div class="gh"><span>${insBtn?"紀錄":"拜訪／聯絡紀錄"}・${n} 筆</span><span class="sp"></span>${insBtn?`<button class="btn sm" id="vNewIns">${ic('car')}保險紀錄</button>`:''}<button class="btn sm pri" id="vNew">${ic('plus')}新增紀錄</button></div>
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
    <div class="t"><div class="n">${esc(p.name)}${p.title?` <small>${esc(p.title)}</small>`:''}${hasIns(p)?`<span class="insic" title="也有保險往來">${ic('car')}</span>`:''}</div><div class="c">${esc(p.mobile||p.phone||p.email||'')}</div></div>
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
/* 保險類別：每台車的車牌和保險到期日，可以直接按「已續保」把到期日往後延一年 */
function carsBlock(c){const cars=c.cars||[];if(!isIns(c)&&!cars.length)return '';
  const row=(x,i)=>{const d=insDays(x);return `<div class="kv"><span class="k">${ic('car')}</span><div style="flex:1;min-width:0"><div class="kl">車牌</div><div class="kvv"><b class="plate">${esc(x.plate||'（沒填車牌）')}</b></div>
      <div class="kl" style="margin-top:4px">保險到期</div><div class="kvv">${x.exp?`${fmtD(x.exp)}・<span class="badge ${insCls(d)}">${insText(d)}</span>`:'<span style="color:var(--sub)">還沒填</span>'}</div></div>
      ${x.exp?`<button class="btn sm" data-renew="${i}" title="到期日往後延一年">${ic('refresh')}已續保 +1 年</button>`:''}</div>`};
  return `<div class="gh">車輛與保險・${cars.length} 台</div><div class="dgrp glass">${cars.map(row).join('')||`<div style="color:var(--sub);font-size:14px;padding:12px 16px">還沒有車牌和保險日期，按「編輯」新增</div>`}</div>`}
function renderPerson(c){
  const co=coOf(c);
  const rows=[
    ['mobile','手機',c.mobile&&telLink(c.mobile)],['phone','公司電話',c.phone&&telLink(c.phone)],['fax','傳真',c.fax&&esc(c.fax)],
    ['mail','Email',c.email&&`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
    ['gift','生日',bdText(c)&&esc(bdText(c))],
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
        ${tagsHTML(co?{}:c,hasIns(c)&&!insOnly(c)?`<span class="badge ${optCls('cat',INS_CAT)}">${esc(INS_CAT)}</span>`:'')}
      </div>
      <div class="photos" id="dPhotos">${['front','back'].filter(s=>c['has'+(s==='front'?'Front':'Back')]).map(s=>`<img data-zoom data-side="${s}" alt="名片${s==='front'?'正面':'背面'}" ${s==='front'&&c.thumb?`src="${c.thumb}"`:''}>`).join('')}</div>
    </div>
    ${co&&!hasIns(c)?'':followBox(c,co?'保險跟進':'')}
  </div>
  <div class="acts">
    <button class="ab p" id="dEdit"><span>${ic('edit')}</span>編輯</button>
    ${co?`<button class="ab" data-go="${co.id}"><span>${ic('building')}</span>公司頁</button>`:`<a class="ab" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(c.company||c.name)}"><span>${ic('globe')}</span>查公司</a>`}
    <button class="ab" id="dAsk"><span>${ic('spark')}</span>拜訪前查詢</button>
  </div>
  ${carsBlock(c)}
  ${rows.length?`<div class="gh">詳細資料</div><div class="dgrp glass">${rows.map(r=>kvRow(r[0],r[1],r[2])).join('')}</div>`:''}
  ${visitsBlock(items.length,items,co?`還沒有跟${esc(c.name)}有關的紀錄。「新增紀錄」會記在「${esc(co.company)}」，窗口選${esc(c.name)}${hasIns(c)?'；「保險紀錄」記在這個人身上，不會出現在公司頁':''}。`:'還沒有紀錄。見面或聯絡後記一筆，下次就知道聊到哪裡。',!!co&&hasIns(c))}
  <div class="dfoot"><span>建立 ${fmtD((c.created||'').slice(0,10))}・最後更新 ${fmtD((c.updated||'').slice(0,10))}</span><span class="sp"></span><button class="btn sm danger" id="dDel">${ic('trash')}刪除這張名片</button></div>`;
  afterDetail(c);
}
const isNarrow=()=>window.innerWidth<=820;
let navDepth=0,afterPop=null;
/* 公司→人這種「往裡面點」時，把上一頁拍一張快照（navStack），右滑返回時底下露出的是上一頁，不是首頁清單 */
const navStack=[];
const trimNav=()=>{if(navStack.length>navDepth)navStack.length=navDepth};
function resetSwipe(){document.body.classList.remove('peek');for(const el of [$('#main'),$('.side')]){if(el){el.style.transition='';el.style.transform='';el.style.opacity=''}}}
function select(id){resetSwipe();const was=S.sel;const snap=was&&isNarrow()?{el:$('#main').cloneNode(true),top:$('#main').scrollTop,id:was}:null;S.sel=id;renderList();renderDetail();$('#main').scrollTop=0;
  if(isNarrow()){window.scrollTo(0,0);const inDetail=history.state&&history.state.detail;if(!was||!inDetail){navDepth=0;history.pushState({detail:id},'')}else if(was!==id){navStack[navDepth]=snap;navDepth++;history.pushState({detail:id},'')}trimNav()}}
function closeDetail(){resetSwipe();S.sel=null;navDepth=0;trimNav();document.body.classList.remove('detail');renderList()}
function goBack(){if(history.state&&history.state.detail)history.back();else closeDetail()}
let skipPop=0;
addEventListener('popstate',()=>{if(skipPop){skipPop--;return}
  const open=$$('.modal.on');
  if(open.length){const m=open[open.length-1];const c=m.querySelector('[data-close]');if(c)c.click();else closeModal(m,true);
    setTimeout(()=>{if(m.classList.contains('on')&&isNarrow())history.pushState({modal:m.id},'')},300);return}
  const st=history.state&&history.state.detail;
  if(st&&!contacts.some(c=>c.id===st)){if(S.sel)closeDetail();return}
  if(st&&st!==S.sel){navDepth=Math.max(0,navDepth-1);const back=navStack[navDepth];trimNav();S.sel=st;renderList();renderDetail();$('#main').scrollTop=back&&back.id===st?back.top:0;if(afterPop){const f=afterPop;afterPop=null;f()}return}
  if(S.sel&&!st)closeDetail()});
/* 放開手指後的動畫（左右滑換類別、右滑返回、右滑關閉全螢幕頁面共用）：
   起步速度接上手指放開時的速度，之後只慢慢減速，不會突然加速。D＝還要移動的距離，v＝手指往那個方向的速度（像素／毫秒） */
function fling(D,v){D=Math.max(D,1);
  if(v>.15){const ms=Math.round(Math.min(320,Math.max(150,1.6*D/v)));const k=v*ms/D;return{ms,ease:`cubic-bezier(.3,${Math.min(1,k*.3).toFixed(3)},.6,1)`}}
  return{ms:Math.round(Math.min(280,Math.max(180,D))),ease:'cubic-bezier(.3,.3,.25,1)'}}
/* swipe right to go back (phone) — iOS 式互動轉場：詳細頁跟著手指走，清單從左邊稍微滑入並變亮 */
(()=>{let x0=0,y0=0,t0=0,dx=0,lastX=0,lastT=0,vx=0,active=false,locked=null,W=0;
  let under=null;
  const main=()=>$('#main'),side=()=>under||$('.side'),EASE='cubic-bezier(.2,.8,.2,1)';
  const showUnder=()=>{const b=navDepth>0&&navStack[navDepth-1];if(!b||!b.el)return;under=b.el;under.removeAttribute('id');under.classList.add('under');under.style.cssText='';$('#main').after(under);under.scrollTop=b.top;document.body.classList.add('deep')};
  const paint=x=>{const p=Math.min(Math.max(x/W,0),1);main().style.transform=`translate3d(${x}px,0,0)`;
    side().style.transform=`translate3d(${-30*(1-p)}%,0,0)`;side().style.opacity=String(.55+.45*p)};
  const clean=()=>{const m=main(),sd=side();for(const el of [m,sd]){el.style.transition='';el.style.transform='';el.style.opacity=''}if(under){under.remove();under=null}document.body.classList.remove('peek','deep')};
  document.addEventListener('touchstart',e=>{active=false;if(!isNarrow()||!document.body.classList.contains('detail')||$$('.modal.on').length||$('#dlg.on')||e.touches.length!==1)return;
    const t=e.touches[0];if(t.clientX<24)return; // 螢幕最左邊交給 iPhone 系統自己的返回手勢
    if(e.target.closest('input,textarea,select'))return;x0=lastX=t.clientX;y0=t.clientY;t0=lastT=e.timeStamp;dx=0;vx=0;active=true;locked=null;W=window.innerWidth},{passive:true});
  document.addEventListener('touchmove',e=>{if(!active)return;const t=e.touches[0];const mx=t.clientX-x0,my=t.clientY-y0;
    if(locked===null&&(Math.abs(mx)>10||Math.abs(my)>10)){locked=Math.abs(mx)>Math.abs(my)*1.2&&mx>0?'h':'v';
      if(locked==='h'){showUnder();document.body.classList.add('peek');main().style.transition='none';side().style.transition='none'}}
    if(locked!=='h')return;
    const dt=e.timeStamp-lastT;if(dt>0)vx=.8*((t.clientX-lastX)/dt)+.2*vx;lastX=t.clientX;lastT=e.timeStamp;
    dx=Math.max(0,mx);paint(dx)},{passive:true});
  const end=()=>{if(!active)return;active=false;if(locked!=='h')return;
    const done=dx>W*.4||(vx>.35&&dx>20);const {ms,ease}=fling(done?W-dx:dx,done?vx:-vx);
    for(const el of [main(),side()])el.style.transition=`transform ${ms}ms ${ease},opacity ${ms}ms ${ease}`;
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
    if(e.target.closest('input,textarea,select,.btable,.chips,.cut,.cropbox,.calgrid'))return;
    x0=lastX=t.clientX;y0=t.clientY;lastT=e.timeStamp;dx=0;vx=0;locked=null;modal=m;box=m.querySelector('.mbox');W=window.innerWidth},{passive:true});
  document.addEventListener('touchmove',e=>{if(!box)return;const t=e.touches[0];const mx=t.clientX-x0,my=t.clientY-y0;
    if(locked===null&&(Math.abs(mx)>10||Math.abs(my)>10)){locked=Math.abs(mx)>Math.abs(my)*1.2&&mx>0?'h':'v';
      if(locked==='h'){box.style.transition='none';modal.style.transition='none';box.style.boxShadow='-12px 0 32px rgba(0,0,0,.4)'}}
    if(locked!=='h')return;const dt=e.timeStamp-lastT;if(dt>0)vx=.8*((t.clientX-lastX)/dt)+.2*vx;lastX=t.clientX;lastT=e.timeStamp;
    dx=Math.max(0,mx);paint(dx)},{passive:true});
  const end=()=>{const b=box,m=modal;box=null;if(!b||locked!=='h')return;
    const done=dx>W*.4||(vx>.35&&dx>20);const {ms,ease}=fling(done?W-dx:dx,done?vx:-vx);
    b.style.transition=`transform ${ms}ms ${ease}`;m.style.transition=`background ${ms}ms ${ease}`;box=b;modal=m;requestAnimationFrame(()=>{paint(done?W:0);box=null});
    setTimeout(()=>{if(done){const c=m.querySelector('[data-close]');m.style.visibility='hidden';if(c)c.click();else closeModal(m);
      requestAnimationFrame(()=>{clean(b,m);m.style.visibility=''})}else clean(b,m)},ms+20)};
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
})();
/* 類別按鈕的「液態玻璃」：一塊半透明玻璃墊在選中的類別下面，換類別時滑過去（會稍微超過再彈回，移動中被壓扁一點） */
const Glass={x:null,w:null,t:0};
function glassEl(){const box=$('#catChips');let g=box.querySelector('.chipglass');
  if(!g){g=document.createElement('span');g.className='chipglass';g.setAttribute('aria-hidden','true');box.prepend(g);if(Glass.x!=null)glassPos(Glass.x,Glass.w,false)}return g}
function glassPos(x,w,anim){const g=glassEl();if(!anim)g.style.transition='none';g.style.left=x+'px';g.style.width=w+'px';
  if(!anim){void g.offsetWidth;g.style.transition=''}Glass.x=x;Glass.w=w}
function paintGlass(){const on=$('#catChips .chip.on');if(!on||!on.offsetWidth)return;const g=glassEl();const x=on.offsetLeft,w=on.offsetWidth;
  g.classList.remove('hold');if(Glass.x===x&&Glass.w===w)return;
  if(Glass.x==null){glassPos(x,w,false);return}
  requestAnimationFrame(()=>{g.classList.add('move');glassPos(x,w,true);clearTimeout(Glass.t);Glass.t=setTimeout(()=>g.classList.remove('move'),220)})}
function glassTo(el){if(!el)return;const g=glassEl();g.classList.remove('hold');g.classList.add('move');glassPos(el.offsetLeft,el.offsetWidth,true);clearTimeout(Glass.t);Glass.t=setTimeout(()=>g.classList.remove('move'),220)}
/* 手指拖到一半：玻璃在兩個按鈕之間，中途被拉長；沒有下一個類別時只稍微被拉一下 */
function glassDrag(a,b,p,dx){if(!a)return;const g=glassEl();g.classList.add('hold');
  if(!b){const s=Math.min(Math.abs(dx)*.12,14);glassPos(dx<0?a.offsetLeft:a.offsetLeft-s,a.offsetWidth+s,false);return}
  const x=a.offsetLeft+(b.offsetLeft-a.offsetLeft)*p,w=a.offsetWidth+(b.offsetWidth-a.offsetWidth)*p,s=Math.sin(Math.PI*p)*18;
  glassPos(x-s/2,w+s,false)}
/* 首頁左右滑切換類別（手機）：像翻書，手指一滑就先把隔壁類別的清單放在旁邊，兩頁一起跟著手指走；
   放開後新的那頁剛好停在定位，中間不會空白；到盡頭會輕輕彈回 */
(()=>{let x0=0,y0=0,dx=0,lastX=0,lastT=0,vx=0,active=false,locked=null,W=0,cats=[],idx=0,chipEls=[],busy=false;
  const pages={};   // -1：左邊（上一個類別）、1：右邊（下一個類別）
  const list=()=>$('#list'),EASE='cubic-bezier(.22,.8,.24,1)';
  const mv=(el,x,ms,ease)=>{el.style.transition=ms?`transform ${ms}ms ${ease||EASE}`:'none';el.style.transform=`translate3d(${x}px,0,0)`};
  const pre={};   // 有空時先準備好的隔壁兩頁（藏起來）
  const make=(d,cs,i)=>{const to=i+d;if(to<0||to>=cs.length)return null;
    const keep=S.cat;S.cat=cs[to];let html='';try{html=listHTML(filtered())}finally{S.cat=keep}
    const el=document.createElement('div');el.className='list catpage';el.innerHTML=html;el.dataset.cat=cs[to];el.dataset.v=listVer;list().after(el);return el};
  const place=(el,d)=>{const l=list();el.style.top=l.offsetTop+'px';el.style.height=l.offsetHeight+'px';mv(el,d*W)};
  const page=d=>{if(pages[d])return pages[d];const to=idx+d;if(to<0||to>=cats.length)return null;
    let el=pre[d];delete pre[d];
    if(!el||el.dataset.cat!==cats[to]||+el.dataset.v!==listVer){if(el)el.remove();el=make(d,cats,idx)}
    place(el,d);el.style.visibility='visible';return pages[d]=el};
  let preT=0;
  catPrebuild=()=>{clearTimeout(preT);preT=setTimeout(()=>{if(busy||!isNarrow()||document.body.classList.contains('detail'))return;
    const cs=$$('#catChips [data-cat]').map(b=>b.dataset.cat),i=cs.indexOf(S.cat);W=list().offsetWidth;
    for(const d of [-1,1]){if(pre[d]){pre[d].remove();delete pre[d]}if(i<0)continue;const el=make(d,cs,i);if(el){el.style.visibility='hidden';place(el,d);mv(el,0);pre[d]=el}}},250)};
  const paint=x=>{mv(list(),x);for(const d of [-1,1])if(pages[d])mv(pages[d],x+d*W)};
  const cleanup=keep=>{for(const d of [-1,1]){const el=pages[d];delete pages[d];if(!el)continue;
      if(keep&&el.isConnected){el.style.visibility='hidden';mv(el,0);pre[d]=el}else el.remove()}
    const l=list();l.style.transition=l.style.transform='';document.body.classList.remove('catswipe');busy=false};
  const showChip=()=>{const on=$('#catChips .chip.on');if(on){const box=$('#catChips');box.scrollTo({left:on.offsetLeft-(box.clientWidth-on.offsetWidth)/2,behavior:'smooth'})}};
  document.addEventListener('touchstart',e=>{active=false;if(busy||!isNarrow()||document.body.classList.contains('detail')||$$('.modal.on').length||$('#dlg.on')||e.touches.length!==1)return;
    if(!e.target.closest('#list'))return;const t=e.touches[0];if(t.clientX<24)return;
    chipEls=$$('#catChips [data-cat]');cats=chipEls.map(b=>b.dataset.cat);idx=cats.indexOf(S.cat);if(cats.length<2||idx<0)return;
    x0=lastX=t.clientX;y0=t.clientY;lastT=e.timeStamp;dx=0;vx=0;locked=null;W=list().offsetWidth;active=true},{passive:true});
  document.addEventListener('touchmove',e=>{if(!active)return;const t=e.touches[0];const mx=t.clientX-x0,my=t.clientY-y0;
    if(locked===null&&(Math.abs(mx)>10||Math.abs(my)>10)){locked=Math.abs(mx)>Math.abs(my)*1.2?'h':'v';if(locked==='h'){busy=true;document.body.classList.add('catswipe')}}
    if(locked!=='h')return;e.preventDefault();
    const dt=e.timeStamp-lastT;if(dt>0)vx=.8*((t.clientX-lastX)/dt)+.2*vx;lastX=t.clientX;lastT=e.timeStamp;
    const d=mx<0?1:-1,nb=page(d);dx=nb?mx:mx*.25;   // 沒有下一個類別時，拉起來比較重（彈性）
    paint(dx);glassDrag(chipEls[idx],nb?chipEls[idx+d]:null,Math.min(Math.abs(dx)/W,1),dx)},{passive:false});
  const end=()=>{if(!active)return;active=false;if(locked!=='h')return;
    const d=dx<0?1:-1,to=idx+d,nb=pages[d];
    const go=!!nb&&(Math.abs(dx)>W*.25||(Math.abs(vx)>.35&&Math.abs(dx)>20&&Math.sign(vx)===Math.sign(dx)));
    if(!go){const {ms,ease}=fling(Math.abs(dx),-Math.sign(dx)*vx);mv(list(),0,ms,ease);for(const k of [-1,1])if(pages[k])mv(pages[k],k*W,ms,ease);paintGlass();setTimeout(()=>cleanup(true),ms+20);return}
    const {ms,ease}=fling(W-Math.abs(dx),Math.sign(dx)*vx);
    mv(list(),-d*W,ms,ease);mv(nb,0,ms,ease);glassTo(chipEls[to]);
    setTimeout(()=>{const top=nb.scrollTop;S.cat=cats[to];listReuse=nb;for(const k of [-1,1])if(pre[k]){pre[k].remove();delete pre[k]}cleanup();renderList();const l=list();l.scrollTop=top;showChip()},ms+20)};
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
})();
function refresh(){renderList();renderDetail()}
