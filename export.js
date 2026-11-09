/* 名片管家：匯出（Excel、Outlook、完整備份）與匯入 */
'use strict';
/* ---------- export ---------- */
async function saveFile(filename,data){
  const ext=filename.split('.').pop();
  const mime={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv;charset=utf-8',json:'application/json'}[ext]||'application/octet-stream';
  const blob=data instanceof Blob?new Blob([data],{type:mime}):new Blob([data],{type:mime});
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&navigator.canShare){const file=new File([blob],filename,{type:mime});
    if(navigator.canShare({files:[file]})){try{await navigator.share({files:[file]});return true}catch(e){if(e&&e.name==='AbortError')return false}}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return true;
}
const scopeList=()=>$('#xScope').value==='filtered'?filtered():contacts;
function expand(list){const out=[],seen=new Set();const add=x=>{if(!seen.has(x.id)){seen.add(x.id);out.push(x)}};
  for(const r of list){add(r);if(isCo(r))peopleOf(r).forEach(add)}return out}
const lastOf=items=>[...items].sort(byDate)[0];
const whoText=(v,co)=>co?[...v.who.map((id,i)=>{const p=contacts.find(x=>x.id===id);return (p?p.name:v.whoN[i]||'')+(p&&p.companyId!==co.id?'（已離職）':'')}).filter(Boolean),...(v.other?[v.other]:[])].join('、'):'';
const XCOLS=['姓名','英文名','公司','統一編號','職稱','部門','手機','公司電話','傳真','Email','地址','其他地址','地區','網站','類別','狀態','加工類型','刀具品牌','認識情境','下次跟進','備註','最近拜訪日','最近拜訪內容','拜訪次數','建立日期','ID'];
const toDate=s=>s?new Date(s.slice(0,10)+'T00:00:00'):'';
function exportXLSX(list){
  if(!window.XLSX){toast('Excel 元件載入失敗，改用 Outlook CSV 或重新整理頁面',4000);return}
  list=expand(list);const cos=list.filter(isCo),ppl=list.filter(c=>!isCo(c));
  const book=(rows,head,widths,name,wb)=>{const ws=XLSX.utils.aoa_to_sheet([head,...rows],{cellDates:true,dateNF:'yyyy/mm/dd'});
    ws['!cols']=widths.map(w=>({wch:w}));ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:head.length-1}})};XLSX.utils.book_append_sheet(wb,ws,name)};
  const wb=XLSX.utils.book_new();
  const CH=['公司','統一編號','公司電話','傳真','地址','其他地址','地區','網站','類別','狀態','加工類型','刀具品牌','下次跟進','備註','聯絡人','拜訪次數','最近拜訪日','最近拜訪內容','建立日期','ID'];
  book(cos.map(c=>{const lv=lastVisit(c);return[c.company,c.taxId,c.phone,c.fax,c.address,addrText(c),c.region,c.website,c.category,c.status,c.processes.join('、'),c.brands,toDate(c.nextFollow),c.notes,
    sortPeople(c).map(p=>p.name+(p.title?'（'+p.title+'）':'')).join('、'),c.visits.length,lv?toDate(lv.date):'',lv?`[${lv.type}] ${lv.content}${lv.next?'（下一步：'+lv.next+'）':''}`:'',toDate(c.created),c.id]}),
    CH,[22,11,16,14,32,40,9,20,10,9,16,18,12,36,30,8,12,40,12,14],'公司',wb);
  book(ppl.map(c=>{const co=coOf(c)||{};const g=k=>c[k]||co[k]||'';const its=personVisits(c);const lv=(lastOf(its)||{}).v;
    return[c.name,c.nameEn,c.company,g('taxId'),c.title,c.dept,c.mobile,c.phone,g('fax'),c.email,g('address'),addrText(c),g('region'),g('website'),co.category||c.category,co.id?co.status:c.status,((co.id?co:c).processes||[]).join('、'),co.id?co.brands:c.brands,c.metAt,toDate(co.id?co.nextFollow:c.nextFollow),c.notes,lv?toDate(lv.date):'',lv?`[${lv.type}] ${lv.content}${lv.next?'（下一步：'+lv.next+'）':''}`:'',its.length,toDate(c.created),c.id]}),
    XCOLS,[10,14,22,11,12,10,15,20,14,26,32,40,9,20,10,9,16,18,20,12,36,12,40,8,12,14],'聯絡人',wb);
  const vr=[];
  for(const r of list){if(!r.visits.length)continue;const co=isCo(r)?r:null;
    r.visits.forEach(v=>{const t=v.trial;const runs=t&&t.runs&&t.runs.length?t.runs:[null];const w=co?whoText(v,co):r.name;
      runs.forEach((x,i)=>{x=x||{};vr.push([toDate(v.date),r.company,w,v.type,i?'':v.content,i?'':v.next,t?t.mat:'',t?t.proc:'',t&&runs.length>1?i+1:'',x.best?'★':'',x.tool||'',t?t.ref:'',x.vc||'',x.f||'',x.ap||'',x.n||'',x.fm||'',x.cool||'',x.life||'',t?t.refLife:'',x.result||'',x.note||'',i?'':(t?t.surf:''),i?'':((v.photos||[]).length||''),r.id])})})}
  vr.sort((a,b)=>(b[0]||0)-(a[0]||0));
  book(vr,['日期','公司','窗口','方式','內容','下一步','工件材質','加工方式','組別','建議條件','試用刀具','對照刀具','Vc','f','ap','S 轉速','F 進給','冷卻','壽命','對照壽命','結果','組備註','觀察','照片數','所屬ID'],
    [12,22,16,9,50,24,12,10,6,8,20,18,7,7,7,8,9,8,12,12,8,20,24,8,14],'拜訪紀錄',wb);
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
  return saveFile(`客戶名片_${stamp()}.xlsx`,new Blob([buf]));
}
const csvCell=v=>{v=String(v??'');return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=rows=>'﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
function noteBlock(c0){const co=coOf(c0);const c=co?{...c0,taxId:c0.taxId||co.taxId,status:co.status,processes:co.processes,brands:co.brands,nextFollow:co.nextFollow,visits:personVisits(c0).map(x=>x.v)}:c0;const p=[];if(c.taxId)p.push('統編：'+c.taxId);if(c.addresses.length)p.push('其他地址：\n'+addrText(c));if(c.metAt)p.push('認識：'+c.metAt);if(c.status)p.push('狀態：'+c.status);if(c.processes.length)p.push('加工：'+c.processes.join('、'));if(c.brands)p.push('刀具品牌：'+c.brands);if(c.nextFollow)p.push('下次跟進：'+fmtD(c.nextFollow));if(c.notes)p.push(c.notes);const lv=lastVisit(c);if(lv)p.push(`最近聯絡 ${fmtD(lv.date)}（${lv.type}）：${lv.content}${lv.next?'；下一步：'+lv.next:''}`);return p.join('\n')}
function exportOutlook(list){
  list=expand(list).filter(c=>!isCo(c));
  const H=['First Name','Last Name','Nickname','Company','Department','Job Title','E-mail Address','Mobile Phone','Business Phone','Business Fax','Business Street','Business City','Business Country/Region','Other Street','Web Page','Notes','Categories'];
  const rows=[H,...list.map(c=>{const[f,l]=splitName(c.name);const tw=c.region&&c.region!=='海外';return[f,l,c.nameEn,c.company,c.dept,c.title,c.email,c.mobile,c.phone,c.fax,c.address,tw?c.region:'',tw?'Taiwan':'',c.addresses[0]?c.addresses[0].address:'',c.website,noteBlock(c),c.category]})];
  return saveFile(`Outlook聯絡人_${stamp()}.csv`,toCSV(rows));
}
async function exportJSON(list){
  const full=list===contacts;list=expand(list);
  const out=[];let i=0;
  for(const c of list){toast(`準備備份檔… ${++i}/${list.length}`,60000);const photos={};
    for(const s of ['front','back'])if(c['has'+(s==='front'?'Front':'Back')]){const d=await Store.getPhoto(c.id,s);if(d)photos[s]=d}
    const visits=[];for(const v of c.visits){const ps=[];for(const ph of v.photos||[]){const d=await VP.get(ph.id);ps.push(d?{...ph,d}:ph)}visits.push({...v,photos:ps})}
    out.push({...c,visits,photos})}
  toast('備份檔準備好了',1500);
  const ok=await saveFile(`名片管家備份_含照片_${stamp()}.json`,JSON.stringify({app:'名片管家',version:2,exported:new Date().toISOString(),contacts:out}));
  if(ok&&full){await Meta.set('lastBackup',new Date().toISOString());checkBackup()}
  return ok;
}

/* ---------- import ---------- */
function parseCSV(text){
  text=text.replace(/^﻿/,'');const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=ch}
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(x=>x.trim()!==''));
}
const CSVMAP={'ID':'id','姓名':'name','英文名':'nameEn','公司':'company','統一編號':'taxId','統編':'taxId','職稱':'title','部門':'dept','手機':'mobile','公司電話':'phone','電話':'phone','傳真':'fax','Email':'email','E-mail':'email','地址':'address','其他地址':'addresses','地區':'region','網站':'website','類別':'category','狀態':'status','加工類型':'processes','刀具品牌':'brands','認識情境':'metAt','備註':'notes','下次跟進':'nextFollow'};
const normDate=s=>{const m=String(s||'').trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);return m?`${m[1]}-${pad(m[2])}-${pad(m[3])}`:''};
function findMatch(c){const dig=s=>(s||'').replace(/\D/g,'');
  return contacts.find(x=>x.id===c.id)||(c.email&&contacts.find(x=>x.email&&x.email.toLowerCase()===c.email.toLowerCase()))||(dig(c.mobile).length>=8&&contacts.find(x=>dig(x.mobile)===dig(c.mobile)))}
async function mergeIn(list,progress){
  let add=0,upd=0,i=0;
  for(const raw of list){
    progress&&progress(++i,list.length);
    const ph=raw.photos&&typeof raw.photos==='object'?raw.photos:{};
    const inc=normalize(raw);const ex=findMatch(inc);
    for(const v of inc.visits)for(const ph of v.photos||[]){if(ph.d){try{await VP.put(ph.id,ph.d,(ex||inc).id);ph.h=ph.h||hashStr(ph.d)}catch(_){}delete ph.d}}
    let m;
    if(!ex){m=inc;add++}else{m={...ex,visits:[...ex.visits]};
      for(const k of [...FIELDS,'category','status'])if(inc[k])m[k]=inc[k];
      if(inc.processes.length)m.processes=inc.processes;
      if(inc.addresses.length){const have=new Set(m.addresses.map(a=>a.address));m.addresses=[...m.addresses,...inc.addresses.filter(a=>!have.has(a.address))]}
      const seen=new Set(m.visits.map(v=>v.date+'|'+v.content));inc.visits.forEach(v=>{const same=m.visits.find(x=>x.id===v.id);if(same){const have=new Set((same.photos||[]).map(p=>p.id));same.photos=[...(same.photos||[]),...(v.photos||[]).filter(p=>!have.has(p.id))]}else if(!seen.has(v.date+'|'+v.content))m.visits.push(v)});upd++}
    for(const s of ['front','back']){const key='has'+(s==='front'?'Front':'Back');
      if(ph[s]&&!(ex&&ex[key])){try{const d=await fileToPhoto(dataUrlToBlob(ph[s]));await setPhoto(m,s,d);if(s==='front')m.thumb=await makeThumb(d)}catch(_){}}}
    if(!ex){if(!ph.front)m.hasFront=false;if(!ph.back)m.hasBack=false}
    await save(m);
  }
  return{add,upd};
}
async function handleImport(file,kind){
  const text=await file.text();
  closeModal($('#mImport'));
  try{
    let list;
    if(kind==='json'){const d=JSON.parse(text);list=Array.isArray(d)?d:d.contacts;if(!Array.isArray(list))throw new Error('檔案格式不對')}
    else{const rows=parseCSV(text);if(rows.length<2)throw new Error('檔案裡沒有資料');const H=rows[0].map(h=>h.trim());
      if(!H.includes('姓名'))throw new Error('找不到「姓名」欄位');
      list=rows.slice(1).map(r=>{const o={};H.forEach((h,i)=>{const k=CSVMAP[h];if(k)o[k]=(r[i]||'').trim()});o.nextFollow=normDate(o.nextFollow);if(!o.id)delete o.id;return o}).filter(o=>o.name)}
    const r=await mergeIn(list,(i,n)=>toast(`匯入中… ${i}/${n}`,60000));
    try{await linkAll()}catch(_){}
    refresh();checkBackup();toast(`新增 ${r.add} 位、更新 ${r.upd} 位`);
  }catch(e){toast('匯入失敗：'+(e&&e.message||'請檢查檔案'),4000)}
}
