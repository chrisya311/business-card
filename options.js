/* 名片管家：自訂選項（類別、狀態、加工類型、地區、拜訪類型、工件材質、冷卻方式、試刀結果） */
'use strict';
/* 每一份清單：標題、在 core.js 裡的陣列（直接改陣列內容，其他程式不用改）、能不能選顏色、不能改名刪除的項目
   資料裡存的是選項的「名字」；改名或刪除時，舊資料保留原本的名字，不會被改掉 */
const OPT_DEF={
  cat:{t:'類別',a:CATS,color:true,lock:{[INS_CAT]:'「保險」類別的人不會接到公司，而且有車牌、保險到期日欄位，所以不能改名或刪除（可以換顏色、調整順序）。'}},
  status:{t:'狀態',a:STATUSES,color:true},
  proc:{t:'加工類型',a:PROCS},
  region:{t:'地區',a:REGIONS},
  vtype:{t:'拜訪類型',a:VTYPES,lock:{試刀:'選「試刀」才會出現試刀欄位，所以不能改名或刪除（可以調整順序）。'}},
  mat:{t:'工件材質',a:MATERIALS},
  cool:{t:'冷卻方式',a:COOLANTS},
  result:{t:'試刀結果',a:RESULTS,color:true}
};
for(const k in OPT_DEF)OPT_DEF[k].def=[...OPT_DEF[k].a];
const OPT_COLORS=[['gray','灰'],['green','綠'],['blue','藍'],['orange','橘'],['red','紅'],['purple','紫']];
const isHex=c=>/^#[0-9a-f]{6}$/i.test(c||'');
const OPT_DEFCOLOR={cat:{客戶:'green',潛在客戶:'blue',經銷商:'orange',供應商:'orange',[INS_CAT]:'purple'},status:{已成交:'green',報價中:'orange'},result:{成功:'green',持平:'orange',失敗:'red'}};
const Opts={
  data:{updated:'',lists:{},colors:{}},
  load(){try{const d=JSON.parse(localStorage.getItem('mpgj.opts')||'null');if(d&&typeof d==='object')this.apply(d)}catch(_){}},
  apply(d){
    this.data={updated:String(d.updated||''),lists:d.lists&&typeof d.lists==='object'?d.lists:{},colors:d.colors&&typeof d.colors==='object'?d.colors:{}};
    // 舊版的「私人」改名成「保險」（顏色也一起帶過去）
    {const L=this.data.lists.cat;if(Array.isArray(L)&&L.includes('私人')){const nl=L.map(x=>x==='私人'?INS_CAT:x);this.data.lists={...this.data.lists,cat:[...new Set(nl)]}}
     const C=this.data.colors.cat;if(C&&C['私人']&&!C[INS_CAT]){this.data.colors={...this.data.colors,cat:{...C,[INS_CAT]:C['私人']}}}}
    for(const k in OPT_DEF){const L=this.data.lists[k];const D=OPT_DEF[k];
      let v=Array.isArray(L)?[...new Set(L.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))]:[...D.def];
      for(const l of Object.keys(D.lock||{}))if(!v.includes(l))v.push(l);
      D.a.length=0;D.a.push(...v)}
  },
  store(){try{localStorage.setItem('mpgj.opts',JSON.stringify(this.data))}catch(_){}},
  save(k,list,colors){this.data={updated:new Date().toISOString(),lists:{...this.data.lists,[k]:list},colors:{...this.data.colors,[k]:colors}};
    this.store();this.apply(this.data);if(typeof Sync!=='undefined')Sync.dirty()},
  /* 同步或匯入時：比較新的那一份贏 */
  adopt(d){if(!d||typeof d!=='object'||!d.lists)return false;if(this.data.updated&&String(d.updated||'')<=this.data.updated)return false;
    this.apply(d);this.store();return true},
  color(k,n){const c=this.data.colors[k];if(c&&c[n])return c[n];return (OPT_DEFCOLOR[k]||{})[n]||'gray'}
};
Opts.load();
const optCls=(k,n)=>{const c=Opts.color(k,n);return colorCls(c)};
/* 自訂顏色（調色盤選的 #RRGGBB）：第一次用到時產生一組樣式，亮色、暗色模式都看得清楚 */
const hexCss=new Set();
function colorCls(c){if(!c||c==='gray')return '';if(!isHex(c))return 'c-'+c;const h=c.slice(1).toLowerCase();
  if(!hexCss.has(h)){hexCss.add(h);let st=document.getElementById('optCss');if(!st){st=document.createElement('style');st.id='optCss';document.head.appendChild(st)}
    const n=parseInt(h,16),r=n>>16,g=n>>8&255,b=n&255,mix=(t,k)=>'#'+[r,g,b].map(v=>Math.round(v+(t-v)*k).toString(16).padStart(2,'0')).join('');
    const lum=(.2126*r+.7152*g+.0722*b)/255;
    st.textContent+=`.badge.c-x${h}{background:rgba(${r},${g},${b},.18);color:${lum<.55?mix(255,.45):c}}`+
      `:root[data-theme=light] .badge.c-x${h}{background:rgba(${r},${g},${b},.14);color:${lum>.45?mix(0,.45):c}}`+
      `.odot.c-x${h}::after,.cdot.c-x${h}{background:${c}}`}
  return 'c-x'+h}
/* 清單＋資料裡用到、但已經不在清單的舊名字（排在後面），表單和篩選才不會把舊資料弄丟 */
const optWith=(k,cur)=>{const a=OPT_DEF[k].a;return [...a,...[...new Set((cur||[]).filter(x=>x&&!a.includes(x)))]]};
const optOld=(k,n)=>!!n&&!OPT_DEF[k].a.includes(n);
const optPlus=(k,extra)=>`<button type="button" class="oplus" data-opt="${k}"${extra||''} aria-label="新增或編輯${OPT_DEF[k].t}" title="新增或編輯${OPT_DEF[k].t}">${ic('plus')}</button>`;
/* 有幾筆資料用到這個名字 */
function optUsage(k,n){let c=0;
  for(const x of contacts){
    if(k==='cat'&&x.category===n)c++;else if(k==='status'&&x.status===n)c++;else if(k==='region'&&x.region===n)c++;
    else if(k==='proc'&&(x.processes||[]).includes(n))c++;
    for(const v of x.visits||[]){if(k==='vtype'&&v.type===n)c++;const t=v.trial;if(!t)continue;
      if(k==='mat'&&t.mat===n)c++;if(k==='proc'&&t.proc===n)c++;
      for(const r of t.runs||[]){if(k==='cool'&&r.cool===n)c++;if(k==='result'&&r.result===n)c++}}}
  return c}

/* ---------- 編輯視窗 ---------- */
const OE={k:null,items:[],pick:-1,newColor:'gray',done:null};
/* 調色盤選好顏色 */
$('#mOpt').addEventListener('change',e=>{const inp=e.target.closest('[data-ocustom]');if(!inp)return;const c=inp.value.toLowerCase();if(!isHex(c))return;
  if(inp.dataset.ocustom==='data-onewc')OE.newColor=c;else if(OE.pick>=0){OE.items[OE.pick].c=c;OE.pick=-1}paintOpts()});
function openOpts(k,done){const D=OPT_DEF[k];
  OE.k=k;OE.done=done||null;OE.pick=-1;OE.newColor='gray';
  OE.items=D.a.map(n=>({n,o:n,c:Opts.color(k,n),cnt:optUsage(k,n)}));
  $('#oTitle').textContent='編輯'+D.t;$('#oNew').value='';$('#oNew').placeholder='新的'+D.t;
  $('#oNote').innerHTML='點一下名字可以改名；長按一列（或按住右邊的 ≡）上下拖曳，可以調整順序。'+(D.color?'點左邊的圓點可以換顏色，按「其他顏色」可以從調色盤挑任何顏色。':'')+'<br>正在使用的選項改名或刪除時，舊資料會保留原本的名字。';
  paintOpts();openModal('#mOpt')}
function paintPal(cur,attr){const used=[...new Set(OE.items.map(x=>x.c).filter(isHex).map(x=>x.toLowerCase()))];if(isHex(cur)&&!used.includes(cur.toLowerCase()))used.push(cur.toLowerCase());
  return OPT_COLORS.map(([c,t])=>`<button type="button" ${attr}="${c}" class="${c===cur?'on':''}"><span class="odot c-${c}"></span>${t}</button>`).join('')
    +used.map(c=>`<button type="button" ${attr}="${c}" class="sw${c===String(cur).toLowerCase()?' on':''}" aria-label="自訂顏色 ${c}"><span class="odot ${colorCls(c)}"></span></button>`).join('')
    +`<label class="ocustom" title="從調色盤選任何顏色"><span class="odot rainbow"></span>其他顏色<input type="color" data-ocustom="${attr}" value="${isHex(cur)?cur:'#3a7bd5'}"></label>`}
function paintOpts(){const D=OPT_DEF[OE.k];const lock=D.lock||{};const n=OE.items.length;
  const np=$('#oNewPal');np.hidden=!D.color;if(D.color)np.innerHTML=paintPal(OE.newColor,'data-onewc');
  $('#oList').innerHTML=OE.items.map((it,i)=>{const lk=lock[it.o];
    return `<div class="orow" data-oi="${i}">${D.color?`<button type="button" class="odot ${colorCls(it.c)}${OE.pick===i?' on':''}" data-ocolor aria-label="換顏色"></button>`:''}
      <input type="text" value="${esc(it.n)}" data-oname aria-label="選項名稱（點一下改名）" readonly>${it.cnt?`<span class="ocnt">${it.cnt} 筆</span>`:''}
      ${lk?`<button type="button" class="olock" data-olock aria-label="不能刪除" title="不能改名或刪除">${ic('lock')}</button>`:`<button type="button" class="rbtn" data-odel aria-label="刪除">${ic('trash')}</button>`}<span class="ogrip" data-ogrip title="按住拖曳排序" aria-hidden="true">${ic('grip')}</span></div>`+
      (OE.pick===i?`<div class="opal">${paintPal(it.c,'data-oc')}</div>`:'')}).join('')||'<div class="orow" style="color:var(--sub);padding:14px">還沒有任何選項</div>'}
const optDup=(name,except)=>OE.items.some((x,j)=>j!==except&&x.n===name);
async function optRename(i,el){const it=OE.items[i];const name=el.value.trim();
  if(!name){el.value=it.n;toast('名稱不能是空的');return}
  if(name===it.n)return;
  if(optDup(name,i)){el.value=it.n;toast(`已經有「${name}」了`);return}
  if(it.o&&it.cnt&&it.n===it.o){
    const ok=await confirmBox(`「${it.o}」目前有 ${it.cnt} 筆資料在用。\n\n改名後，這 ${it.cnt} 筆舊資料會保留原本的「${it.o}」，之後新增的資料才會用「${name}」。`,{ok:'仍要修改',cancel:'取消修改'});
    if(!ok){el.value=it.n;return}}
  it.n=name}
function optAdd(){const el=$('#oNew');const name=el.value.trim();if(!name)return;
  if(optDup(name,-1)){toast(`已經有「${name}」了`);return}
  OE.items.push({n:name,o:null,c:OE.newColor,cnt:0});el.value='';OE.pick=-1;paintOpts();
  const rows=$$('#oList .orow');const last=rows[rows.length-1];if(last)last.scrollIntoView({block:'nearest'})}
$('#oAdd').onclick=optAdd;
$('#oNew').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();optAdd()}});
$('#oList').addEventListener('change',e=>{const el=e.target.closest('[data-oname]');if(el)optRename(+el.closest('.orow').dataset.oi,el)});
$('#oList').addEventListener('focusout',e=>{if(e.target.matches('[data-oname]'))e.target.readOnly=true});
$('#oList').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target.matches('[data-oname]')){e.preventDefault();e.target.blur()}});
$('#mOpt').addEventListener('click',async e=>{const t=e.target;
  const nc=t.closest('[data-onewc]');if(nc){OE.newColor=nc.dataset.onewc;paintOpts();return}
  const row=t.closest('.orow');const pal=t.closest('.opal');
  if(pal&&!row){const c=t.closest('[data-oc]');if(c&&OE.pick>=0){OE.items[OE.pick].c=c.dataset.oc;OE.pick=-1;paintOpts()}return}
  if(!row||row.dataset.oi===undefined||OE.justDragged)return;const i=+row.dataset.oi;const it=OE.items[i];
  const nm=t.closest('[data-oname]');if(nm){if(OPT_DEF[OE.k].lock&&OPT_DEF[OE.k].lock[it.o]){infoBox(OPT_DEF[OE.k].lock[it.o]);return}if(nm.readOnly){nm.readOnly=false;nm.focus();const n=nm.value.length;try{nm.setSelectionRange(n,n)}catch(_){}}return}
  if(t.closest('[data-ocolor]')){OE.pick=OE.pick===i?-1:i;paintOpts();return}
  if(t.closest('[data-oup]')&&i>0){[OE.items[i-1],OE.items[i]]=[OE.items[i],OE.items[i-1]];OE.pick=-1;paintOpts();return}
  if(t.closest('[data-odown]')&&i<OE.items.length-1){[OE.items[i+1],OE.items[i]]=[OE.items[i],OE.items[i+1]];OE.pick=-1;paintOpts();return}
  if(t.closest('[data-olock]')){infoBox(OPT_DEF[OE.k].lock[it.o]);return}
  if(t.closest('[data-odel]')){
    if(it.o&&it.cnt){const ok=await confirmBox(`「${it.o}」目前有 ${it.cnt} 筆資料在用。\n\n刪除後，這 ${it.cnt} 筆舊資料會保留「${it.o}」，只是之後不能再選它。`,{ok:'仍要刪除',cancel:'取消',danger:true});if(!ok)return}
    OE.items.splice(i,1);OE.pick=-1;paintOpts()}
});
$('#oSave').onclick=()=>{const k=OE.k;if(!k)return;
  // 輸入框還沒按 Enter 的新選項，也一起加進去
  if($('#oNew').value.trim())optAdd();
  const list=OE.items.map(x=>x.n);
  const colors={...(Opts.data.colors[k]||{})};
  // 舊名字（改名、刪除前）保留原本的顏色，舊資料看起來才會一樣
  if(OPT_DEF[k].color){for(const n of OPT_DEF[k].a)if(!(n in colors))colors[n]=Opts.color(k,n);for(const x of OE.items)colors[x.n]=x.c}
  Opts.save(k,list,colors);
  const added=OE.items.filter(x=>!x.o).map(x=>x.n),done=OE.done;OE.k=null;
  closeModal($('#mOpt'));optRefresh();if(done)done(added)};

/* 選項改了之後，把畫面上用到的地方重新畫一次（表單裡已經選的東西保留） */
function optRefresh(){
  if(typeof fillOptSelects==='function')fillOptSelects();
  if($('#mEdit').classList.contains('on')&&typeof paintEditOpts==='function')paintEditOpts(readEditOpts());
  if($('#mVisit').classList.contains('on')&&typeof renderRuns==='function')renderRuns(readRuns());
  refresh()}
/* 長按一列（或按住右邊的 ≡）上下拖曳排序 */
(()=>{let timer=null,drag=null,sx=0,sy=0,lastY=0,scr=null;
  const box=()=>$('#mOpt');
  const start=(row,y)=>{timer=null;
    if(OE.pick>=0){const i=row.dataset.oi;OE.pick=-1;paintOpts();row=$(`#oList .orow[data-oi="${i}"]`);if(!row)return}
    const ae=document.activeElement;if(ae&&ae.matches&&ae.matches('[data-oname]'))ae.blur();
    const r=row.getBoundingClientRect();drag={row,off:y-r.top,ty:0};lastY=y;row.classList.add('drag');
    // 拖到視窗上下邊緣時自動捲動
    scr=setInterval(()=>{if(!drag)return;const m=box(),h=window.innerHeight;const v=lastY<110?-10:lastY>h-110?10:0;if(v){m.scrollTop+=v;move(lastY)}},30)};
  const move=y=>{lastY=y;const d=drag,row=d.row,want=y-d.off;
    for(let k=0;k<50;k++){const prev=row.previousElementSibling,next=row.nextElementSibling;
      if(prev&&prev.matches('.orow[data-oi]')){const pr=prev.getBoundingClientRect();if(want<pr.top+pr.height/2){row.after(prev);continue}}
      if(next&&next.matches('.orow[data-oi]')){const nr=next.getBoundingClientRect();if(want+row.offsetHeight>nr.top+nr.height/2){next.after(row);continue}}
      break}
    const nat=row.getBoundingClientRect().top-d.ty;d.ty=want-nat;row.style.transform=`translateY(${d.ty}px)`};
  const end=()=>{clearTimeout(timer);timer=null;clearInterval(scr);if(!drag)return;const row=drag.row;drag=null;
    row.style.transform='';row.classList.remove('drag');
    const order=$$('#oList .orow[data-oi]').map(r=>+r.dataset.oi);OE.items=order.map(i=>OE.items[i]);
    paintOpts();OE.justDragged=true;setTimeout(()=>{OE.justDragged=false},80)};
  const begin=(e,y,x)=>{const row=e.target.closest('#oList .orow[data-oi]');if(!row||drag)return false;
    if(e.target.closest('[data-ogrip]')){start(row,y);return true}
    if(e.target.closest('button,.opal'))return false;
    const inp=e.target.closest('[data-oname]');if(inp&&!inp.readOnly)return false;
    sx=x;sy=y;clearTimeout(timer);timer=setTimeout(()=>start(row,sy),400);return false};
  const L=$('#oList');
  L.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];if(begin(e,t.clientY,t.clientX))e.preventDefault()},{passive:false});
  document.addEventListener('touchmove',e=>{const t=e.touches[0];if(drag){e.preventDefault();move(t.clientY);return}
    if(timer&&(Math.abs(t.clientX-sx)>8||Math.abs(t.clientY-sy)>8)){clearTimeout(timer);timer=null}},{passive:false});
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
  L.addEventListener('mousedown',e=>{if(e.button===0&&begin(e,e.clientY,e.clientX))e.preventDefault()});
  document.addEventListener('mousemove',e=>{if(drag){e.preventDefault();move(e.clientY);return}if(timer&&(Math.abs(e.clientX-sx)>8||Math.abs(e.clientY-sy)>8)){clearTimeout(timer);timer=null}});
  document.addEventListener('mouseup',end);
  L.addEventListener('contextmenu',e=>{if(e.target.closest('.orow'))e.preventDefault()});
})();
