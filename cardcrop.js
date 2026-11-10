/* 名片管家：名片自動裁切＋轉正（在手機上直接算，不用網路、不花 AI 額度）
   找名片像「拿尺去比」：先找出照片裡又長又直的線，再挑出最像名片外框的四條——
   框裡面和框外面顏色差很多、而且整條邊都連貫的那一組。另外也用「油漆桶」（把跟桌面顏色接近的地方塗掉）
   找一個候選，兩種一起比分數，挑最可信的。
   分數太低（找不到可信的四條邊）就保留原本的照片，可以按「裁切」自己拖四個角。 */
'use strict';
const slotOrig={scan:{front:null,back:null},edit:{front:null,back:null}};   // 每個照片框的原始照片和四個角，給「裁切」微調用
const CARD_RATIO=90/54;   // 台灣名片 9 × 5.4 公分
const CROP_MIN=12;        // 分數低於這個就當作沒找到
const CROP_V=1;           // 照片整理過的版本：舊名片照片自動裁切一次後記上這個號碼，就不會重複整理

function imgToCanvas(img,max){const s=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s));cv.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s));
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv}

/* ---------- 找名片的四個角 ----------
   回傳 {quad:[左上,右上,右下,左下]（原圖座標）, score:可信度, area:佔照片的比例}，完全找不到回傳 null */
function findCard(img){
  const cv=imgToCanvas(img,420),w=cv.width,h=cv.height,N=w*h;if(w<40||h<40)return null;
  const src=cv.getContext('2d').getImageData(0,0,w,h).data;
  let R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N);
  for(let i=0;i<N;i++){R[i]=src[i*4];G[i]=src[i*4+1];B[i]=src[i*4+2]}
  // 1. 模糊一點，名片上的灰塵、桌面的木紋比較不會干擾
  const blur=(a,r=2)=>{const t=new Float32Array(N),o=new Float32Array(N);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let k=-r;k<=r;k++){const xx=x+k;if(xx>=0&&xx<w){s+=a[y*w+xx];n++}}t[y*w+x]=s/n}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let k=-r;k<=r;k++){const yy=y+k;if(yy>=0&&yy<h){s+=t[yy*w+x];n++}}o[y*w+x]=s/n}return o};
  // 找直線用輕微模糊（名片邊緣常常只是一條細細的亮邊），打分數和油漆桶用比較模糊的
  const R1=blur(R,1),G1=blur(G,1),B1=blur(B,1);R=blur(R);G=blur(G);B=blur(B);
  const cands=[];
  try{for(const q of houghQuads(w,h,R1,G1,B1))cands.push(q)}catch(_){}
  try{const q=floodQuad(w,h,R,G,B);if(q)cands.push(q)}catch(_){}
  // 2. 每個候選打分數：沿著四條邊，比較框內、框外的顏色差
  // 先用少少的點粗算，留下前 60 名再仔細算
  let list=[];
  for(const q0 of cands){const q=orderQuad(q0);if(!convex(q))continue;const a=polyArea(q)/N;if(a<.05||a>.985)continue;list.push({q,area:a,c:quadScore(q,w,h,R,G,B,10)})}
  const cTop=Math.max(0,...list.map(x=>x.c));list=list.filter(x=>x.c>=Math.max(6,cTop*.3)).sort((x,y)=>y.c-x.c).slice(0,1500);
  for(const x of list)x.score=quadScore(x.q,w,h,R,G,B,40);
  if(!list.length)return null;
  // 分數夠高的裡面，挑「最外圈」的：名片的外框一定把名片上的色塊、logo 都包在裡面
  // 另外框裡面和框外面「整體」的顏色要差夠多（框外應該是桌面）；已經裁好的名片照片，框內框外都是名片紙，就不要再切
  const top=Math.max(...list.map(x=>x.score));
  const ok=list.filter(x=>x.score>=Math.max(CROP_MIN,top*.45)).sort((x,y)=>y.area-x.area||y.score-x.score);
  let best=null;
  for(const x of ok){if(best&&x.area<best.area*.98)break;if(regionDiff(x.q,w,h,R,G,B)<16||!sidesBelong(x.q,w,h,R,G,B))continue;if(!best||x.score>best.score)best=x}
  if(!best)return null;
  // 照片本身已經是名片的比例（之前裁過了），又只找到裡面一小塊：多半是名片上的圖案，不要切
  const ir=w/h;if((Math.abs(ir/CARD_RATIO-1)<.06||Math.abs(ir*CARD_RATIO-1)<.06)&&best.area<.6)return null;
  const k=(img.naturalWidth||img.width)/w,q=best.q;
  // 往內收一點點：寧可切掉名片最邊邊，也不要留一條桌面
  const cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4,f=.01;
  return{quad:q.map(([x,y])=>[(x+(cx-x)*f)*k,(y+(cy-y)*f)*k]),score:best.score,area:best.area}}
function detectCard(img,min=CROP_MIN){const r=findCard(img);return r&&r.score>=min?r.quad:null}

function regionDiff(q,w,h,R,G,B){const inn=[[],[],[]],out=[[],[],[]];
  const inside=(x,y)=>{let s=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];const c=Math.sign((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]));if(!c)continue;if(!s)s=c;else if(c!==s)return false}return true};
  for(let gy=0;gy<28;gy++)for(let gx=0;gx<28;gx++){const x=(gx+.5)*w/28,y=(gy+.5)*h/28,i=Math.floor(y)*w+Math.floor(x);const t=inside(x,y)?inn:out;t[0].push(R[i]);t[1].push(G[i]);t[2].push(B[i])}
  if(inn[0].length<8||out[0].length<8)return 0;const md=a=>{a.sort((p,r)=>p-r);return a[a.length>>1]};
  return Math.hypot(md(inn[0])-md(out[0]),md(inn[1])-md(out[1]),md(inn[2])-md(out[2]))}
/* 每條邊：內側（往內 4 格）要跟更裡面（往內 13 格）的名片很像，外側（往外 4 格）要跟名片不像。
   比的是「附近」，所以名片上有反光也沒關係；桌面上的反光邊界、木紋，兩邊都是桌面，就不會被當成名片的邊 */
function sidesBelong(q,w,h,R,G,B){const cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4;
  // 色彩（不管亮暗）：反光只會變亮、不會改變顏色，所以用色彩比「內側像不像名片」
  const chroma=c=>{const t=c[0]+c[1]+c[2]+30;return[c[0]/t,c[1]/t,c[2]/t]};
  const inside=(x,y)=>{let sg=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];const c=Math.sign((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]));if(!c)continue;if(!sg)sg=c;else if(c!==sg)return false}return true};
  const xs=q.map(p=>p[0]),ys=q.map(p=>p[1]),X0=Math.max(0,Math.min(...xs)),X1=Math.min(w-1,Math.max(...xs)),Y0=Math.max(0,Math.min(...ys)),Y1=Math.min(h-1,Math.max(...ys));
  const CC=[[],[],[]];for(let gy=0;gy<20;gy++)for(let gx=0;gx<20;gx++){const x=X0+(gx+.5)*(X1-X0)/20,y=Y0+(gy+.5)*(Y1-Y0)/20;if(!inside(x,y))continue;const i=Math.floor(y)*w+Math.floor(x);const c=chroma([R[i],G[i],B[i]]);CC[0].push(c[0]);CC[1].push(c[1]);CC[2].push(c[2])}
  const md=a=>{a.sort((p,r)=>p-r);return a[a.length>>1]||0};
  const col=(x,y)=>{const px=Math.round(x),py=Math.round(y);if(px<0||py<0||px>=w||py>=h)return null;const i=py*w+px;return[R[i],G[i],B[i]]};
  const dist=(p,r)=>Math.hypot(p[0]-r[0],p[1]-r[1],p[2]-r[2]);
  if(CC[0].length<10)return false;const card=CC.map(md);
  for(let s=0;s<4;s++){const a=q[s],b=q[(s+1)%4];const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
    if(nx*(cx-(a[0]+b[0])/2)+ny*(cy-(a[1]+b[1])/2)<0){nx=-nx;ny=-ny}
    const dI=[],dO=[],hI=[],hO=[];
    for(let k=0;k<30;k++){const t=.1+.8*k/29,x=a[0]+dx*t,y=a[1]+dy*t;const ci=col(x+nx*7,y+ny*7),cd=col(x+nx*16,y+ny*16),co=col(x-nx*7,y-ny*7);
      if(!ci||!cd)continue;dI.push(dist(ci,cd));hI.push(dist(chroma(ci),card));if(co){dO.push(dist(co,cd));hO.push(dist(chroma(co),card))}}
    if(dI.length<8)return false;if(dO.length<8)continue;   // 這條邊貼著照片邊緣：外面看不到，不檢查
    const dIn=md(dI),dOut=md(dO);

    if(dOut<10||dIn>dOut*.6)return false;
    const cIn=md(hI),cOut=md(hO);if(cIn>cOut*.7+.03)return false}
  return true}
function convex(q){let sg=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4];const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cr)<1e-6)return false;const s=Math.sign(cr);if(!sg)sg=s;else if(s!==sg)return false}return true}
/* 一條邊的分數：沿著邊取 40 個點，每個點比較往內 3 格、往外 3 格的顏色差；取偏低的那一段（要整條邊大部分都有差，才算真的邊） */
function quadScore(q,w,h,R,G,B,n=40){const cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4;
  const at=(x,y)=>{if(x<0||y<0||x>w-1||y>h-1)return null;const i=(Math.round(y)*w+Math.round(x));return[R[i],G[i],B[i]]};
  const sides=[];
  for(let s=0;s<4;s++){const a=q[s],b=q[(s+1)%4];const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
    const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;if(nx*(cx-mx)+ny*(cy-my)<0){nx=-nx;ny=-ny}
    const v=[];for(let k=0;k<n;k++){const t=.08+.84*k/(n-1),x=a[0]+dx*t,y=a[1]+dy*t;const pi=at(x+nx*3,y+ny*3),po=at(x-nx*3,y-ny*3);
      v.push(pi&&po?Math.hypot(pi[0]-po[0],pi[1]-po[1],pi[2]-po[2]):0)}
    v.sort((p,r)=>p-r);sides.push(v[Math.floor(v.length*.35)])}
  const mn=Math.min(...sides),mean=sides.reduce((s,x)=>s+x,0)/4;return .7*mn+.3*mean}

/* 找直線（霍夫轉換）：每個邊緣點替「可能經過它的直線」投票，票多的就是又長又直的線；
   再把差不多平行的兩條配成一對，兩對差不多垂直的組成一個四邊形 */
function houghQuads(w,h,R,G,B){const N=w*h;
  const mag=new Float32Array(N),ang=new Float32Array(N);const ms=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;let bm=0,bx=0,by=0;
    for(const C of [R,G,B]){const gx=(C[i-w+1]+2*C[i+1]+C[i+w+1])-(C[i-w-1]+2*C[i-1]+C[i+w-1]),gy=(C[i+w-1]+2*C[i+w]+C[i+w+1])-(C[i-w-1]+2*C[i-w]+C[i-w+1]);
      const m=gx*gx+gy*gy;if(m>bm){bm=m;bx=gx;by=gy}}
    mag[i]=Math.sqrt(bm)/4;ang[i]=Math.atan2(by,bx);if((x+y)%3===0)ms.push(mag[i])}
  ms.sort((a,b)=>a-b);const th=Math.max(4,ms[Math.floor(ms.length*.72)]),cap=th*2;
  const T=180,D=Math.ceil(Math.hypot(w,h)),RW=2*D+1,acc=new Float32Array(T*RW);
  const cs=new Float32Array(T),sn=new Float32Array(T);for(let t=0;t<T;t++){cs[t]=Math.cos(t*Math.PI/180);sn[t]=Math.sin(t*Math.PI/180)}
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x,m=mag[i];if(m<th)continue;const wt=Math.min(m,cap);
    let ti=Math.round(((ang[i]%Math.PI)+Math.PI)%Math.PI*180/Math.PI);
    for(let d=-4;d<=4;d++){const t=(ti+d+T)%T;acc[t*RW+Math.round(x*cs[t]+y*sn[t])+D]+=wt}}
  // 找票數最高的線（附近的不重複算）
  let mx=0;for(let i=0;i<acc.length;i++)if(acc[i]>mx)mx=acc[i];if(!mx)return[];
  const pk=[];for(let i=0;i<acc.length;i++)if(acc[i]>mx*.07)pk.push(i);pk.sort((a,b)=>acc[b]-acc[a]);
  const lines=[];const near=(a,b)=>{let dt=Math.abs(a.t-b.t),r2=b.r;if(dt>90){dt=180-dt;r2=-b.r}return dt<=6&&Math.abs(a.r-r2)<=10};
  for(const i of pk){const l={t:Math.floor(i/RW),r:i%RW-D,v:acc[i]};if(lines.some(o=>near(o,l)))continue;lines.push(l);if(lines.length>=50)break}
  // 平行的配成一對
  const mn=Math.min(w,h),pairs=[];
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const a=lines[i],b=lines[j];let dt=Math.abs(a.t-b.t),rb=b.r;if(dt>90){dt=180-dt;rb=-b.r}
    if(dt<=12&&Math.abs(a.r-rb)>mn*.12)pairs.push([a,b,a.t])}
  const X=(a,b)=>{const ta=a.t*Math.PI/180,tb=b.t*Math.PI/180;const d=Math.cos(ta)*Math.sin(tb)-Math.sin(ta)*Math.cos(tb);if(Math.abs(d)<1e-6)return null;
    return[(a.r*Math.sin(tb)-b.r*Math.sin(ta))/d,(b.r*Math.cos(ta)-a.r*Math.cos(tb))/d]};
  const out=[],mg=.04;
  for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){const P=pairs[i],Q=pairs[j];let dt=Math.abs(P[2]-Q[2]);if(dt>90)dt=180-dt;if(dt<55)continue;
    const c=[X(P[0],Q[0]),X(P[0],Q[1]),X(P[1],Q[1]),X(P[1],Q[0])];
    if(c.some(p=>!p||p[0]<-w*mg||p[1]<-h*mg||p[0]>w*(1+mg)||p[1]>h*(1+mg)))continue;
    const a=polyArea(c);if(a<N*.05||a>N*.985)continue;
    const L=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]),s1=(L(c[0],c[1])+L(c[2],c[3]))/2,s2=(L(c[1],c[2])+L(c[3],c[0]))/2,ar=Math.max(s1,s2)/Math.min(s1,s2);
    if(ar>2.6)continue;out.push(c)}
  return out}

/* 油漆桶：從照片四邊開始，把跟桌面顏色接近、連在一起的地方塗掉，剩下最大的一塊的外框 */
function floodQuad(w,h,R,G,B){const N=w*h;
  const ring=[];for(let x=0;x<w;x++){ring.push(x,(h-1)*w+x)}for(let y=1;y<h-1;y++){ring.push(y*w,y*w+w-1)}
  const med=a=>{const v=ring.map(i=>a[i]).sort((p,q)=>p-q);return v[v.length>>1]};
  const br=med(R),bg=med(G),bb=med(B);
  const dBg=i=>Math.hypot(R[i]-br,G[i]-bg,B[i]-bb);
  const ds=ring.map(dBg).sort((p,q)=>p-q);const spread=ds[Math.floor(ds.length*.8)];
  const TG=Math.max(30,Math.min(95,spread*2.2+18)),TL=22;
  const bgM=new Uint8Array(N),st=[];
  for(const i of ring)if(!bgM[i]&&dBg(i)<TG){bgM[i]=1;st.push(i)}
  while(st.length){const i=st.pop(),x=i%w,y=(i-x)/w;
    const go=j=>{if(bgM[j])return;if(dBg(j)<TG&&Math.hypot(R[j]-R[i],G[j]-G[i],B[j]-B[i])<TL){bgM[j]=1;st.push(j)}};
    if(x>0)go(i-1);if(x<w-1)go(i+1);if(y>0)go(i-w);if(y<h-1)go(i+w)}
  const morph=(m,grow)=>{const o=new Uint8Array(N);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=m[i];
      if(grow){if(!v)v=(x>0&&m[i-1])||(x<w-1&&m[i+1])||(y>0&&m[i-w])||(y<h-1&&m[i+w])?1:0}
      else if(v)v=(x>0&&m[i-1])&&(x<w-1&&m[i+1])&&(y>0&&m[i-w])&&(y<h-1&&m[i+w])?1:0;o[i]=v}return o};
  let fg=new Uint8Array(N);for(let i=0;i<N;i++)fg[i]=bgM[i]?0:1;
  fg=morph(morph(morph(morph(fg,false),false),true),true);
  const lab=new Int32Array(N);let best=0,bestN=0,cur=0;
  for(let s=0;s<N;s++){if(!fg[s]||lab[s])continue;cur++;let n=0;const q=[s];lab[s]=cur;
    while(q.length){const i=q.pop();n++;const x=i%w;
      for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<N&&fg[j]&&!lab[j]){lab[j]=cur;q.push(j)}}
    if(n>bestN){bestN=n;best=cur}}
  if(bestN<N*.05||bestN>N*.97)return null;
  const pts=[];for(let y=0;y<h;y++){let a=-1,b=-1;for(let x=0;x<w;x++)if(lab[y*w+x]===best){if(a<0)a=x;b=x}if(a>=0){pts.push([a,y]);if(b!==a)pts.push([b+1,y])}}
  let hull=convexHull(pts);if(hull.length<4)return null;
  for(let eps=1;hull.length>40;eps+=.5)hull=simplifyLoop(hull,eps);
  const quad=maxQuad(hull);if(!quad)return null;
  if(bestN/polyArea(quad)<.75)return null;   // 形狀不像長方形（例如連手一起）
  return quad}

function convexHull(p){p=[...p].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
  up.pop();lo.pop();return lo.concat(up)}
/* 把凸包上幾乎在同一直線的點拿掉，點少一點比較快 */
function simplifyLoop(p,eps){if(p.length<=8)return p;const out=[];const n=p.length;
  for(let i=0;i<n;i++){const a=out.length?out[out.length-1]:p[n-1],b=p[i],c=p[(i+1)%n];
    const d=Math.abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))/(Math.hypot(c[0]-a[0],c[1]-a[1])||1);if(d>eps)out.push(b)}
  return out.length>=4?out:p}
const polyArea=q=>{let s=0;for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2};
function maxQuad(p){const n=p.length;if(n<4)return null;let best=0,bq=null;const tri=(a,b,c)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  for(let i=0;i<n;i++)for(let k=i+2;k<n;k++){let m1=0,j1=-1;for(let j=i+1;j<k;j++){const t=tri(p[i],p[j],p[k]);if(t>m1){m1=t;j1=j}}
    let m2=0,l1=-1;for(let l=k+1;l<n+i;l++){const t=tri(p[i],p[k],p[l%n]);if(t>m2){m2=t;l1=l%n}}
    if(j1>=0&&l1>=0&&m1+m2>best){best=m1+m2;bq=[p[i],p[j1],p[k],p[l1]]}}
  return bq}
/* 排成 左上、右上、右下、左下（照著照片原本的方向） */
function orderQuad(q){const cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4;
  const s=[...q].sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));   // 順時針（y 往下）
  let st=0,m=Infinity;s.forEach((p,i)=>{const v=p[0]+p[1];if(v<m){m=v;st=i}});return [0,1,2,3].map(i=>s[(st+i)%4])}

/* ---------- 把四邊形拉成長方形（透視校正） ---------- */
function homography(from,to){// 解 8 個未知數：to = H·from
  const A=[],b=[];for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}
  for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
    const d=A[c][c]||1e-12;for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/d;if(!f)continue;for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
  return b.map((v,i)=>v/(A[i][i]||1e-12))}
function warpCard(img,quad,maxOut=1400){
  const [tl,tr,br,bl]=quad,L=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  let W=Math.max(L(tl,tr),L(bl,br)),H=Math.max(L(tl,bl),L(tr,br));if(W<10||H<10)return null;
  // 比例接近標準名片就直接調成標準比例（拍歪造成的變形會一起修正）
  const r=W/H;if(r>=1&&Math.abs(r/CARD_RATIO-1)<.2)H=W/CARD_RATIO;else if(r<1&&Math.abs(r*CARD_RATIO-1)<.2)W=H/CARD_RATIO;
  const s=Math.min(1,maxOut/Math.max(W,H));W=Math.round(W*s);H=Math.round(H*s);
  const srcCv=imgToCanvas(img,2400),sk=srcCv.width/(img.naturalWidth||img.width),sw=srcCv.width,sh=srcCv.height;
  const S=srcCv.getContext('2d').getImageData(0,0,sw,sh).data;
  const h=homography([[0,0],[W,0],[W,H],[0,H]],quad.map(([x,y])=>[x*sk,y*sk]));
  const out=document.createElement('canvas');out.width=W;out.height=H;const g=out.getContext('2d');const od=g.createImageData(W,H),D=od.data;
  for(let y=0;y<H;y++){for(let x=0;x<W;x++){const u=x+.5,v=y+.5,z=h[6]*u+h[7]*v+1;let sx=(h[0]*u+h[1]*v+h[2])/z-.5,sy=(h[3]*u+h[4]*v+h[5])/z-.5;
      sx=sx<0?0:sx>sw-1?sw-1:sx;sy=sy<0?0:sy>sh-1?sh-1:sy;const x0=sx|0,y0=sy|0,x1=Math.min(x0+1,sw-1),y1=Math.min(y0+1,sh-1),fx=sx-x0,fy=sy-y0;
      const a=(y0*sw+x0)*4,b=(y0*sw+x1)*4,c=(y1*sw+x0)*4,d=(y1*sw+x1)*4,o=(y*W+x)*4;
      for(let k=0;k<3;k++)D[o+k]=(S[a+k]*(1-fx)+S[b+k]*fx)*(1-fy)+(S[c+k]*(1-fx)+S[d+k]*fx)*fy;D[o+3]=255}}
  g.putImageData(od,0,0);return out.toDataURL('image/jpeg',.92)}

/* 壓到 230KB 以下（雲端同步每筆的大小限制），跟原本存照片的規則一樣 */
async function compressPhoto(src){let q=.8,max=1400,d=await shrinkTo(src,max,q);
  while(d.length>230000&&(q>.45||max>700)){if(q>.5)q-=.1;else max-=200;d=await shrinkTo(src,max,q)}return d}

/* 選好一張名片照片：自動裁切轉正。回傳 {d:存起來的照片, orig:原始照片（給微調用）, quad:四個角或 null} */
async function cardPhoto(file){
  const url=typeof file==='string'?file:URL.createObjectURL(file);
  try{const img=await loadImg(url);const orig=imgToCanvas(img,1800).toDataURL('image/jpeg',.88);const oi=await loadImg(orig);
    let quad=null,d='';try{quad=detectCard(oi);if(quad){const w=warpCard(oi,quad);if(w)d=await compressPhoto(w);else quad=null}}catch(_){quad=null}
    if(!d)d=await compressPhoto(orig);
    return{d,orig,quad}}
  finally{if(typeof file!=='string')URL.revokeObjectURL(url)}}
/* 放進照片框，順便告訴使用者有沒有裁到 */
async function putCardPhoto(target,side,file){const r=await cardPhoto(file);slotState[target][side]=r.d;slotOrig[target][side]={src:r.orig,quad:r.quad};paintSlots(target);
  toast(r.quad?'已自動裁切、轉正名片，不滿意可以按「裁切」調整':'沒找到名片的邊，先保留整張照片，可以按「裁切」自己拉四個角',3200);return r}

/* ---------- 手動調整：拖四個角 ---------- */
const CR={target:null,side:null,img:null,quad:null,drag:-1};
async function openCrop(target,side){const o=slotOrig[target][side];const src=o&&o.src||slotState[target][side];if(!src)return;
  CR.target=target;CR.side=side;CR.img=await loadImg(src);const W=CR.img.naturalWidth,H=CR.img.naturalHeight;
  CR.quad=o&&o.quad?o.quad.map(p=>[...p]):fullQuad();
  if(!o)slotOrig[target][side]={src,quad:null};
  $('#cropImg').src=src;$('#cropSvg').setAttribute('viewBox',`0 0 ${W} ${H}`);paintCrop();openModal('#mCrop')}
const fullQuad=()=>{const W=CR.img.naturalWidth,H=CR.img.naturalHeight,m=Math.min(W,H)*.04;return [[m,m],[W-m,m],[W-m,H-m],[m,H-m]]};
function paintCrop(){const W=CR.img.naturalWidth,H=CR.img.naturalHeight,q=CR.quad;
  const pts=q.map(p=>p.join(',')).join(' L');
  $('#cropSvg').innerHTML=`<path d="M0,0 H${W} V${H} H0 Z M${pts} Z" fill="rgba(0,0,0,.5)" fill-rule="evenodd"/><path d="M${pts} Z" fill="none" stroke="#8FD3B0" stroke-width="${Math.max(W,H)/220}"/>`;
  $$('#cropBox .ch').forEach((el,i)=>{el.style.left=(q[i][0]/W*100)+'%';el.style.top=(q[i][1]/H*100)+'%'})}
(()=>{const box=$('#cropBox'),lp=$('#cropLoupe');
  const at=(e)=>{const r=$('#cropImg').getBoundingClientRect(),W=CR.img.naturalWidth,H=CR.img.naturalHeight;
    return[Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W)),Math.max(0,Math.min(H,(e.clientY-r.top)/r.height*H)),r]};
  const loupe=(x,y,r)=>{const W=CR.img.naturalWidth,H=CR.img.naturalHeight,Z=3,S=110;const px=x/W*r.width,py=y/H*r.height;
    lp.hidden=false;lp.style.backgroundImage=`url("${$('#cropImg').src}")`;lp.style.backgroundSize=`${r.width*Z}px ${r.height*Z}px`;
    lp.style.backgroundPosition=`${S/2-px*Z}px ${S/2-py*Z}px`;lp.style.left=px+'px';lp.style.top=(py-S*.95)+'px'};
  box.addEventListener('pointerdown',e=>{const h=e.target.closest('.ch');let i=h?+h.dataset.i:-1;
    if(i<0){// 點在照片上：抓最近的角
      const [x,y,r]=at(e);let m=Infinity;CR.quad.forEach((p,j)=>{const d=Math.hypot(p[0]-x,p[1]-y);if(d<m){m=d;i=j}});
      if(m/CR.img.naturalWidth*r.width>60)return}
    e.preventDefault();CR.drag=i;box.setPointerCapture(e.pointerId);const [x,y,r]=at(e);CR.quad[i]=[x,y];paintCrop();loupe(x,y,r)});
  box.addEventListener('pointermove',e=>{if(CR.drag<0)return;e.preventDefault();const [x,y,r]=at(e);CR.quad[CR.drag]=[x,y];paintCrop();loupe(x,y,r)});
  const end=()=>{CR.drag=-1;lp.hidden=true};box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
})();
$('#cropFull').onclick=()=>{CR.quad=fullQuad();paintCrop()};
$('#cropAuto').onclick=()=>{const q=detectCard(CR.img);if(q){CR.quad=q;paintCrop();toast('找到名片了')}else toast('找不到名片的邊，請自己拖四個角')};
$('#cropOk').onclick=async()=>{const q=orderQuad(CR.quad);if(polyArea(q)<CR.img.naturalWidth*CR.img.naturalHeight*.02){toast('範圍太小了');return}
  const btn=$('#cropOk');btn.disabled=true;
  try{const w=warpCard(CR.img,q);if(!w){toast('範圍太小了');return}const d=await compressPhoto(w);
    slotState[CR.target][CR.side]=d;slotOrig[CR.target][CR.side].quad=q;paintSlots(CR.target);closeModal($('#mCrop'));
    if(CR.target==='scan')$('#scanStatus').hidden=true}
  catch(_){toast('裁切失敗，請再試一次')}finally{btn.disabled=false}};

/* ---------- 以前存的名片照片：自動裁切、轉正一次 ----------
   原始照片留在這台手機（按「編輯 → 裁切」可以重新調整）；比較沒把握的就不切，只把縮圖換成橫式 */
let fixRun=false;
async function fixOldPhotos(){if(fixRun)return;fixRun=true;let n=0,done=0;
  try{const todo=contacts.filter(c=>!isCo(c)&&(c.hasFront||c.hasBack)&&(c.cropV||0)<CROP_V);
    for(const c0 of todo){const c=contacts.find(x=>x.id===c0.id);if(!c||(c.cropV||0)>=CROP_V)continue;
      const nc={...c};let changed=false;
      for(const s of ['front','back']){if(!nc['has'+(s==='front'?'Front':'Back')])continue;const ph=await Store.getPhoto(nc.id,s);if(!ph)continue;
        try{const img=await loadImg(ph);const r=findCard(img);
          if(r&&r.score>=CROP_MIN+3&&r.area<.92){const w=warpCard(img,orderQuad(r.quad));if(w){const d=await compressPhoto(w);
            if(!await Store.getOrig(nc.id,s))await Store.putOrig(nc.id,s,{d:ph,q:orderQuad(r.quad)});await setPhoto(nc,s,d);changed=true;if(s==='front')n++}}}catch(_){}
        await new Promise(r=>setTimeout(r,30))}   // 讓畫面有空喘口氣，不會卡住
      const front=nc.hasFront?await Store.getPhoto(nc.id,'front'):'';if(front)nc.thumb=await makeThumb(front);
      nc.cropV=CROP_V;const cur=contacts.find(x=>x.id===nc.id);if(!cur||cur.updated!==c.updated)continue;   // 整理途中被修改過就下次再說
      await save(nc);done++;if(done%5===0)renderList()}
  }finally{fixRun=false;if(done){refresh();if(n)toast(`已自動裁切 ${n} 張舊名片照片，不滿意可以到「編輯 → 裁切」調整`,4000)}}}
