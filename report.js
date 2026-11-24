/* 名片管家：工作報告
   給老闆看：選期間 → 數字總覽、每月聯絡次數、各客戶進展；可以複製、匯出 Excel，或請 AI 寫成一篇報告。
   保險相關的人和紀錄一律不算進來。 */
'use strict';
const STATUS_LOG_SINCE='2026-11-24';   // 從這天開始記錄「狀態哪天改的」，之前的成交日期查不到
const RP_RANGES=[['year','今年'],['q','這一季'],['lastq','上一季'],['d30','近 30 天'],['custom','自訂']];
const RP={range:'year',from:'',to:'',data:null,ai:'',aiFor:'',busy:false};

/* 期間 → [開始日, 結束日]（都是 YYYY-MM-DD） */
function rpRange(k){const t=new Date(),y=t.getFullYear(),q=Math.floor(t.getMonth()/3);
  if(k==='year')return[`${y}-01-01`,today()];
  if(k==='q')return[ymd(new Date(y,q*3,1)),today()];
  if(k==='lastq')return[ymd(new Date(y,q*3-3,1)),ymd(new Date(y,q*3,0))];
  if(k==='d30')return[addDays(today(),-29),today()];
  return[RP.from,RP.to]}
const rpIn=(d,a,b)=>!!d&&d>=a&&d<=b;

/* 把所有紀錄整理成報告要用的資料 */
function rpBuild(a,b){
  const groups=new Map(),items=[];
  for(const r of contacts){
    if(insOnly(r))continue;                       // 只有保險往來的人：整個跳過
    const co=isCo(r)?r:null,owner=co||coOf(r);
    for(const v of r.visits||[]){
      if(v.ins||!rpIn(v.date,a,b))continue;       // 保險紀錄、期間外的：跳過
      const key=owner?owner.id:r.id,name=owner?owner.company:(r.company||r.name);
      let g=groups.get(key);if(!g){g={name,status:(owner||r).status||'',visits:[]};groups.set(key,g)}
      const it={date:v.date,company:name,who:co?whoText(v,co):r.name,type:v.type,content:v.content||'',next:v.next||'',
        trial:v.trial||null,result:trialResult(v.trial),status:g.status};
      g.visits.push(it);items.push(it)}}
  const byDate=(x,y)=>x.date.localeCompare(y.date);
  items.sort(byDate);for(const g of groups.values())g.visits.sort(byDate);
  const count=(list,f)=>{const o={};for(const x of list){const k=f(x);o[k]=(o[k]||0)+1}return o};
  const byType=count(items,x=>x.type);
  const trials=items.filter(x=>x.trial||x.type==='試刀');
  const res=count(trials,x=>x.result||'未填結果');
  const fresh=contacts.filter(c=>!insOnly(c)&&rpIn((c.created||'').slice(0,10),a,b));
  const newCo=fresh.filter(isCo).length,newP=fresh.length-newCo;
  const won=contacts.filter(c=>!insOnly(c)&&(c.statusLog||[]).some(l=>l.s==='已成交'&&rpIn(l.d,a,b))).map(c=>isCo(c)?c.company:(c.company||c.name));
  const months=[];for(let d=new Date(a.slice(0,7)+'-01T00:00:00');ymd(d)<=b;d.setMonth(d.getMonth()+1))months.push(ymd(d).slice(0,7));
  const perMonth=months.map(m=>{const l=items.filter(x=>x.date.startsWith(m));return{m,n:l.length,t:count(l,x=>x.type)}});
  // 排序：有試刀成功、已成交、報價中的客戶放前面，其他照聯絡次數
  const rank=g=>(g.visits.some(v=>v.result==='成功')?4:0)+(g.status==='已成交'?2:g.status==='報價中'?1:0);
  const cos=[...groups.values()].sort((x,y)=>rank(y)-rank(x)||y.visits.length-x.visits.length||x.name.localeCompare(y.name,'zh-Hant'));
  return{a,b,items,byType,trials:trials.length,res,newCo,newP,won,perMonth,cos}}

const rpSorted=o=>Object.entries(o).sort((x,y)=>y[1]-x[1]);
const rpTrial=t=>t?[t.mat,t.proc].filter(Boolean).join(' '):'';
const rpDate=(D,d)=>D.a.slice(0,4)===D.b.slice(0,4)?fmtD(d).slice(5):fmtD(d);
const rpOne=s=>String(s||'').replace(/\s*\n+\s*/g,' ').trim();

/* 純文字版：「複製全部」和交給 AI 的資料都用這個 */
function rpText(D){const L=[];
  L.push(`工作報告　${fmtD(D.a)} – ${fmtD(D.b)}`,'','【總覽】');
  L.push(`聯絡 ${D.items.length} 次`+(D.items.length?`（${rpSorted(D.byType).map(([k,n])=>k+' '+n).join('、')}）`:''));
  L.push(`接觸客戶 ${D.cos.length} 家`,`新增名片：公司 ${D.newCo} 家、聯絡人 ${D.newP} 位`);
  if(D.trials)L.push(`試刀 ${D.trials} 次：`+rpSorted(D.res).map(([k,n])=>k+' '+n).join('、'));
  if(D.won.length)L.push(`轉為已成交 ${D.won.length} 家：${D.won.join('、')}`);
  L.push('','【每月聯絡次數】',D.perMonth.map(x=>`${x.m.replace('-','/')} ${x.n} 次`).join('、'));
  if(D.cos.length)L.push('','【客戶進展】');
  for(const g of D.cos){L.push(`■ ${g.name}${g.status?`（目前：${g.status}）`:''}　共 ${g.visits.length} 次`);
    for(const v of g.visits){const body=[rpTrial(v.trial),rpOne(v.content)].filter(Boolean).join('，')||'（沒寫內容）';
      L.push(`  ${rpDate(D,v.date)} ${v.type}${v.who?'｜'+v.who:''}：${body}${v.result?' → '+v.result:''}${v.next?`（下一步：${rpOne(v.next)}）`:''}`)}}
  return L.join('\n')}

/* ---------- 畫面 ---------- */
function openReport(){RP.range=RP.range||'year';paintReportRanges();openModal('#mReport');paintReport()}
function paintReportRanges(){
  $('#rpRanges').innerHTML=RP_RANGES.map(([k,t])=>`<button type="button" class="chip${RP.range===k?' on':''}" data-rp="${k}" aria-pressed="${RP.range===k}">${t}</button>`).join('');
  const cu=RP.range==='custom';$('#rpCustom').hidden=!cu;
  if(cu){if(!RP.from)RP.from=`${new Date().getFullYear()}-01-01`;if(!RP.to)RP.to=today();$('#rpFrom').value=RP.from;$('#rpTo').value=RP.to}}
function paintReport(){
  const [a,b]=rpRange(RP.range);const box=$('#rpBody');
  if(!a||!b||a>b){box.innerHTML='<div class="rpnote">請選好開始和結束日期（開始要在結束之前）</div>';RP.data=null;return}
  const D=RP.data=rpBuild(a,b);
  if(RP.aiFor!==a+'|'+b){RP.ai='';RP.aiFor=''}      // 換了期間，舊的 AI 報告就不適用
  const succ=D.res['成功']||0,max=Math.max(1,...D.perMonth.map(x=>x.n));
  const tile=(n,t,u)=>`<div class="rptile"><b>${n}<small>${u||''}</small></b>${t}</div>`;
  const cfg=AI.get(),pv=PROVIDERS[cfg.provider].name;
  box.innerHTML=`
  <div class="rpacts"><span class="rpper">${fmtD(a)} – ${fmtD(b)}</span><span class="sp"></span>
    <button type="button" class="btn sm" id="rpCopy">${ic('copy')}複製全部</button><button type="button" class="btn sm" id="rpXlsx">${ic('table')}匯出 Excel</button></div>
  <div class="rptiles">${tile(D.items.length,'聯絡次數',' 次')}${tile(D.cos.length,'接觸客戶',' 家')}${tile(D.newCo+D.newP,'新增名片',' 張')}${tile(D.trials?succ+'/'+D.trials:'0','試刀成功')}</div>
  ${D.items.length?`<div class="rptypes">${rpSorted(D.byType).map(([k,n])=>`<span class="badge">${esc(k)} ${n}</span>`).join('')}${D.trials?rpSorted(D.res).map(([k,n])=>`<span class="badge ${resultCls(k)}">試刀${esc(k)} ${n}</span>`).join(''):''}</div>`:''}
  <div class="rpnote">${D.won.length?`轉為已成交 <b>${D.won.length}</b> 家：${D.won.map(esc).join('、')}。`:''}${a<STATUS_LOG_SINCE?`「轉為已成交」從 ${fmtD(STATUS_LOG_SINCE)} 才開始記錄，更早成交的不會算在這裡，可以看下面每家客戶的目前狀態。`:''}新增名片：公司 ${D.newCo} 家、聯絡人 ${D.newP} 位。不含保險。</div>
  <div class="gh"><span>每月聯絡次數</span></div>
  <div class="dgrp glass rpbars" role="img" aria-label="${esc(D.perMonth.map(x=>`${+x.m.slice(5)} 月 ${x.n} 次`).join('，'))}">${D.perMonth.map(x=>`<div class="rpbar"><em>${x.n||''}</em><i style="height:${x.n?Math.max(4,x.n/max*100):0}%"></i><span>${+x.m.slice(5)}月</span></div>`).join('')}</div>
  <div class="gh"><span>AI 寫成報告</span></div>
  <div class="dgrp glass rpai">${!D.items.length?'<div class="rpnote" style="margin:0">這段期間沒有紀錄，沒東西可以寫。</div>'
    :RP.ai?`<textarea id="rpAiText" aria-label="AI 寫的報告，可以直接修改">${esc(RP.ai)}</textarea><div class="rpacts" style="margin-bottom:0"><span class="rpnote" style="margin:0">可以直接在上面修改</span><span class="sp"></span><button type="button" class="btn sm" id="rpAiCopy">${ic('copy')}複製報告</button><button type="button" class="btn sm" id="rpAiGo">${ic('refresh')}重寫</button></div>`
    :`<div class="rpnote" style="margin:0 0 10px">會把這段期間的紀錄（客戶公司、窗口姓名、紀錄內容；<b>不含</b>電話和地址）傳給 ${esc(pv)}，請它寫成給老闆看的報告，大約 10 到 30 秒。</div>
      ${cfg.key?`<button type="button" class="btn pri" id="rpAiGo">${ic('spark')}請 AI 寫成報告</button>`:'<div class="rpnote" style="margin:0">要先到右上角「設定」填 AI 金鑰才能用。</div>'}`}</div>
  <div class="gh"><span>客戶進展・${D.cos.length} 家</span></div>
  ${D.cos.map(g=>`<div class="dgrp glass rpco"><div class="rpch"><b>${esc(g.name)}</b>${g.status?`<span class="badge ${optCls('status',g.status)}">${esc(g.status)}</span>`:''}<span class="sp"></span><small>${g.visits.length} 次</small></div>
    ${g.visits.map(v=>`<div class="rpv"><div class="rpm"><span>${rpDate(D,v.date)}</span><span class="badge">${esc(v.type)}</span>${v.result?`<span class="badge ${resultCls(v.result)}">${esc(v.result)}</span>`:''}${v.who?`<span>${esc(v.who)}</span>`:''}</div>
      <div class="rpc">${esc([rpTrial(v.trial),v.content].filter(Boolean).join('，')||'（沒寫內容）')}${v.next?`<div class="nx">→ ${esc(v.next)}</div>`:''}</div></div>`).join('')}</div>`).join('')||'<div class="rpnote">這段期間沒有拜訪或聯絡紀錄。</div>'}`;
  if(RP.busy)rpBusy(true)}

/* ---------- AI 寫報告 ---------- */
function rpBusy(on){const b=$('#rpAiGo');if(!b)return;b.disabled=on;if(on)b.innerHTML=`${ic('spark')}AI 撰寫中…`}
async function rpAskAI(){
  const D=RP.data;if(!D||RP.busy)return;
  const data=rpText(D).slice(0,24000);
  const prompt=`你是業務助理。以下是一位刀具業務在 ${fmtD(D.a)} 到 ${fmtD(D.b)} 的工作紀錄。請寫一份給老闆看的工作報告，使用繁體中文（台灣用語），語氣專業、精簡。
結構：
一、總覽（關鍵數字）
二、重點成果（試刀成功、已成交、報價中的客戶）
三、各客戶進展（挑重要的，一家一兩句）
四、下一步計畫（根據紀錄裡的「下一步」整理）
規則：只能使用下面資料裡的事實，不要編造數字、客戶或成果；資料裡沒有的就不要寫。用純文字，可以用「一、」「•」條列，不要用 Markdown 符號（例如 # 或 **）。
請只回傳 JSON：{"report":"報告全文"}

資料：
${data}`;
  RP.busy=true;rpBusy(true);
  try{const t=await callAI(prompt,[],null,{...AI.get(),maxTokens:4000});
    const j=parseJSONText(t);let rep=j&&typeof j.report==='string'?j.report:String(t);
    rep=rep.replace(/\*\*/g,'').replace(/^#+\s*/gm,'').trim();
    RP.ai=rep;RP.aiFor=D.a+'|'+D.b;toast('AI 報告寫好了')}
  catch(e){infoBox(scanErrMsg(e&&e.code)+(e&&e.status?`\n\n錯誤代碼 ${e.status}：${e.message||''}`:''))}
  finally{RP.busy=false;if($('#mReport').classList.contains('on'))paintReport()}}

/* ---------- 匯出 Excel ---------- */
function rpExcel(){const D=RP.data;if(!D)return;
  if(!window.XLSX){toast('Excel 元件載入失敗，請重新整理頁面',4000);return}
  const wb=XLSX.utils.book_new();
  const add=(name,rows,widths)=>{const ws=XLSX.utils.aoa_to_sheet(rows,{cellDates:true,dateNF:'yyyy/mm/dd'});ws['!cols']=widths.map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws,name)};
  add('總覽',[['期間',`${fmtD(D.a)} – ${fmtD(D.b)}`],['聯絡次數',D.items.length],...rpSorted(D.byType).map(([k,n])=>['　'+k,n]),
    ['接觸客戶（家）',D.cos.length],['新增公司',D.newCo],['新增聯絡人',D.newP],['試刀次數',D.trials],...rpSorted(D.res).map(([k,n])=>['　試刀'+k,n]),
    ['轉為已成交（家）',D.won.length],['已成交客戶',D.won.join('、')],[],['說明',`不含保險。「轉為已成交」從 ${fmtD(STATUS_LOG_SINCE)} 開始記錄。`]],[18,60]);
  if(RP.ai)add('AI 報告',RP.ai.split('\n').map(l=>[l]),[110]);
  const types=Object.keys(D.byType);
  add('每月',[['月份','聯絡次數',...types],...D.perMonth.map(x=>[x.m.replace('-','/'),x.n,...types.map(k=>x.t[k]||0)])],[10,10,...types.map(()=>9)]);
  add('客戶進展',[['客戶','目前狀態','聯絡次數','試刀次數','試刀成功','最近聯絡','最近內容','下一步'],...D.cos.map(g=>{const l=g.visits[g.visits.length-1];const tr=g.visits.filter(v=>v.trial||v.type==='試刀');
    return[g.name,g.status,g.visits.length,tr.length,tr.filter(v=>v.result==='成功').length,toDate(l.date),rpOne(l.content),rpOne([...g.visits].reverse().map(v=>v.next).find(Boolean)||'')]})],[24,10,9,9,9,12,50,30]);
  add('紀錄明細',[['日期','客戶','窗口','方式','內容','下一步','工件材質','加工方式','試刀結果'],...D.items.map(v=>[toDate(v.date),v.company,v.who,v.type,v.content,v.next,v.trial?v.trial.mat||'':'',v.trial?v.trial.proc||'':'',v.result])],[12,24,16,9,60,30,12,12,10]);
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
  return saveFile(`工作報告_${D.a.replace(/-/g,'')}-${D.b.replace(/-/g,'')}.xlsx`,new Blob([buf]))}

/* ---------- 事件 ---------- */
$('#xReport').onclick=()=>{closeModal($('#mExport'));openReport()};
$('#rpRanges').addEventListener('click',e=>{const b=e.target.closest('[data-rp]');if(!b)return;RP.range=b.dataset.rp;paintReportRanges();paintReport()});
$('#rpFrom').addEventListener('change',e=>{RP.from=e.target.value;paintReport()});
$('#rpTo').addEventListener('change',e=>{RP.to=e.target.value;paintReport()});
$('#rpBody').addEventListener('click',e=>{const t=e.target;
  if(t.closest('#rpCopy')){if(RP.data)copyText(rpText(RP.data),'報告內容',t.closest('#rpCopy'));return}
  if(t.closest('#rpXlsx')){rpExcel();return}
  if(t.closest('#rpAiGo')){rpAskAI();return}
  if(t.closest('#rpAiCopy')){copyText(RP.ai,' AI 報告',t.closest('#rpAiCopy'));return}});
$('#rpBody').addEventListener('input',e=>{if(e.target.id==='rpAiText')RP.ai=e.target.value});
