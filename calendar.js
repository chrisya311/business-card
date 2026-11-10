/* 名片管家：日曆（生日、保險到期、跟進日期）
   一個月一格，上下滑動看其他月份；滑到快到底時自動再多接幾個月。上面的按鈕可以快速顯示或隱藏某一種日子。 */
'use strict';
const CAL_TYPES=[['bd','生日','gift'],['ins','保險到期','car'],['fu','跟進','clock']];
const Cal={on:{bd:true,ins:true,fu:true},from:null,to:null,sel:'',ev:new Map(),evFrom:0,evTo:0};
try{const v=JSON.parse(localStorage.getItem('mpgj.calTypes')||'null');if(v&&typeof v==='object')for(const k in Cal.on)if(typeof v[k]==='boolean')Cal.on[k]=v[k]}catch(_){}
const ymKey=(y,m)=>y*12+m;   // 月份編號（m 從 0 開始），方便加減
/* 把 y0～y1 年之間的事件整理成「日期 → 清單」 */
function calBuild(y0,y1){const ev=new Map();const add=(d,e)=>{if(!ev.has(d))ev.set(d,[]);ev.get(d).push(e)};
  for(const c of contacts){
    if(!isCo(c)){const b=bdParts(c.birthday);
      if(b)for(let y=y0;y<=y1;y++){if(b.y&&y<b.y)continue;const dd=b.m===2&&b.d===29&&new Date(y,1,29).getMonth()!==1?28:b.d;
        add(`${y}-${pad(b.m)}-${pad(dd)}`,{t:'bd',id:c.id,title:c.name,sub:b.y&&y>b.y?`${y-b.y} 歲生日`:'生日'})}
      for(const x of c.cars||[])if(x.exp)add(x.exp,{t:'ins',id:c.id,title:c.name,sub:`${x.plate||'車'} 保險到期`})}
    if(isRow(c)&&c.nextFollow)add(c.nextFollow,{t:'fu',id:c.id,title:rowTitle(c),sub:followState(c)==='od'?`跟進（${followText(c)}）`:'跟進'})}
  for(const l of ev.values())l.sort((a,b)=>CAL_TYPES.findIndex(t=>t[0]===a.t)-CAL_TYPES.findIndex(t=>t[0]===b.t));
  Cal.ev=ev;Cal.evFrom=y0;Cal.evTo=y1}
const calShown=d=>(Cal.ev.get(d)||[]).filter(e=>Cal.on[e.t]);
function monthHTML(k){const y=Math.floor(k/12),m=k%12;const first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),td=today();
  let cells='';for(let i=0;i<first;i++)cells+='<span class="cd blank"></span>';
  for(let d=1;d<=n;d++){const ds=`${y}-${pad(m+1)}-${pad(d)}`;const es=calShown(ds);const types=[...new Set(es.map(e=>e.t))];
    cells+=`<button type="button" class="cd${ds===td?' today':''}${ds===Cal.sel?' sel':''}${es.length?' has':''}" data-d="${ds}" aria-label="${m+1} 月 ${d} 日${es.length?`，${es.length} 件事`:''}"><span class="n">${d}</span><span class="dots">${types.map(t=>`<i class="t-${t}"></i>`).join('')}</span></button>`}
  return `<section class="calm" data-k="${k}"><h3>${y} 年 ${m+1} 月</h3><div class="calgrid">${cells}</div></section>`}
function calEnsureEv(){const y0=Math.floor(Cal.from/12),y1=Math.floor(Cal.to/12);if(y0<Cal.evFrom||y1>Cal.evTo)calBuild(y0,y1)}
function paintCalMonths(){calEnsureEv();let h='';for(let k=Cal.from;k<=Cal.to;k++)h+=monthHTML(k);$('#calMonths').innerHTML=h}
function paintCalTypes(){const cnt=t=>{let n=0;const y=new Date().getFullYear();for(const [d,l] of Cal.ev)if(d.startsWith(y+'-'))n+=l.filter(e=>e.t===t).length;return n};
  $('#calTypes').innerHTML=CAL_TYPES.map(([t,n,i])=>`<button type="button" class="ctype${Cal.on[t]?' on':''}" data-ct="${t}" aria-pressed="${Cal.on[t]}"><i class="t-${t}"></i>${n}</button>`).join('')
    +'<span class="cthint">點一下可以隱藏或顯示</span>'}
function paintCalDay(){const d=Cal.sel;const [y,m,dd]=d.split('-').map(Number);const w='日一二三四五六'[new Date(y,m-1,dd).getDay()];
  const diff=daysBetween(today(),d);const rel=diff===0?'今天':diff===1?'明天':diff===-1?'昨天':diff>0?`${diff} 天後`:`${-diff} 天前`;
  const es=calShown(d);const hidden=(Cal.ev.get(d)||[]).length-es.length;
  $('#calDay').innerHTML=`<div class="cdh"><b>${m} 月 ${dd} 日（${w}）</b><span>${rel}</span></div>`+
    (es.length?es.map(e=>`<button type="button" class="cev" data-calgo="${e.id}"><i class="t-${e.t}"></i><span class="ct"><b>${esc(e.title)}</b><small>${esc(e.sub)}</small></span>${ic('chev')}</button>`).join('')
      :`<div class="cnone">這天沒有${Cal.on.bd&&Cal.on.ins&&Cal.on.fu?'':'顯示中的'}事項${hidden?`（有 ${hidden} 件被隱藏）`:''}</div>`)}
function calScrollTo(k,smooth){const el=$(`#calMonths .calm[data-k="${k}"]`),s=$('#calScroll');if(el)s.scrollTo({top:el.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-4,behavior:smooth?'smooth':'auto'})}
function openCal(){const t=new Date();const k=ymKey(t.getFullYear(),t.getMonth());
  Cal.from=k-6;Cal.to=k+12;Cal.evFrom=Infinity;Cal.evTo=-Infinity;Cal.sel=today();
  calEnsureEv();paintCalTypes();paintCalMonths();paintCalDay();openModal('#mCal');requestAnimationFrame(()=>calScrollTo(k))}
/* 滑到上面或下面快到底時，再多接 6 個月 */
$('#calScroll').addEventListener('scroll',()=>{const s=$('#calScroll');
  if(s.scrollTop<400&&Cal.from>ymKey(1900,0)){const h0=s.scrollHeight;Cal.from-=6;calEnsureEv();let h='';for(let k=Cal.from;k<Cal.from+6;k++)h+=monthHTML(k);
    $('#calMonths').insertAdjacentHTML('afterbegin',h);s.scrollTop+=s.scrollHeight-h0}
  else if(s.scrollTop+s.clientHeight>s.scrollHeight-400){const a=Cal.to+1;Cal.to+=6;calEnsureEv();let h='';for(let k=a;k<=Cal.to;k++)h+=monthHTML(k);$('#calMonths').insertAdjacentHTML('beforeend',h)}},{passive:true});
$('#calMonths').addEventListener('click',e=>{const b=e.target.closest('.cd[data-d]');if(!b)return;
  const old=$('#calMonths .cd.sel');if(old)old.classList.remove('sel');b.classList.add('sel');Cal.sel=b.dataset.d;paintCalDay()});
$('#calTypes').addEventListener('click',e=>{const b=e.target.closest('[data-ct]');if(!b)return;const t=b.dataset.ct;Cal.on[t]=!Cal.on[t];
  try{localStorage.setItem('mpgj.calTypes',JSON.stringify(Cal.on))}catch(_){}
  const s=$('#calScroll'),top=s.scrollTop;paintCalTypes();paintCalMonths();s.scrollTop=top;paintCalDay()});
$('#calToday').onclick=()=>{const t=new Date();Cal.sel=today();const k=ymKey(t.getFullYear(),t.getMonth());
  $$('#calMonths .cd.sel').forEach(x=>x.classList.remove('sel'));const b=$(`#calMonths .cd[data-d="${Cal.sel}"]`);if(b)b.classList.add('sel');paintCalDay();calScrollTo(k,true)};
/* 點日期下面的人：關掉日曆，打開那個人（或公司） */
$('#calDay').addEventListener('click',e=>{const b=e.target.closest('[data-calgo]');if(!b)return;const id=b.dataset.calgo;if(!contacts.some(x=>x.id===id))return;
  closeModal($('#mCal'));S.sel=id;navDepth=0;
  if(isNarrow()){if(history.state&&history.state.modal)history.replaceState({detail:id},'');else if(!(history.state&&history.state.detail))history.pushState({detail:id},'');window.scrollTo(0,0)}
  refresh();$('#main').scrollTop=0});
