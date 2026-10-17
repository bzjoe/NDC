const defaultData=[{"x":0,"y":28.77},{"x":6.7,"y":28.61},{"x":13.47,"y":25.25},{"x":21.95,"y":23.9},{"x":31.19,"y":23.69},{"x":31.74,"y":23.59},{"x":42.2,"y":19.54},{"x":58.04,"y":18.04},{"x":86,"y":17.45},{"x":115.7,"y":17.67},{"x":139.77,"y":16.98},{"x":169.64,"y":16.76},{"x":187.41,"y":14.62},{"x":188.56,"y":11.85},{"x":199.34,"y":10.7},{"x":206.49,"y":9.79},{"x":219.48,"y":8.49},{"x":229.36,"y":7.65},{"x":239.39,"y":7.44},{"x":254.45,"y":7.33},{"x":269.64,"y":8.15},{"x":283.8,"y":7.7},{"x":300.43,"y":6.46},{"x":311.14,"y":6.04},{"x":320.12,"y":7.92},{"x":330.35,"y":8.88},{"x":339.18,"y":8.77},{"x":350.08,"y":8.1},{"x":359.61,"y":8.29},{"x":365.68,"y":9.72},{"x":370.56,"y":14.04},{"x":379.36,"y":16.27},{"x":384.52,"y":25.42},{"x":405.55,"y":27.73}];
let normalDepth={lengthUnits:'ft',wse:8,depth:4,flowArea:0,XSData:defaultData.map(p=>({...p})),n_lob:0.045,n_ch:0.030,n_rob:0.045,slope:0.002,q:20000,leftBank:187.41,rightBank:370.56};
const $=id=>document.getElementById(id); const f=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';

function parseData(text){const lines=text.trim().split(/\r?\n/),out=[];for(const line of lines){const a=line.trim().split(/[,\s]+/).filter(Boolean);if(a.length>=2){const x=parseFloat(a[0]),y=parseFloat(a[1]);if(Number.isFinite(x)&&Number.isFinite(y))out.push({x,y});}}return out}

function renderPlot(){
  const svg=$('plot'),W=900,H=430,p={l:55,r:20,t:22,b:42};
  svg.innerHTML='';
  const d=normalDepth.XSData,w=normalDepth.wse;
  const xmin=Math.min(...d.map(p=>p.x)),xmax=Math.max(...d.map(p=>p.x));
  const ymin=Math.min(...d.map(p=>p.y),w),ymax=Math.max(...d.map(p=>p.y),w);
  const sx=x=>p.l+(x-xmin)/(xmax-xmin)*(W-p.l-p.r),sy=y=>H-p.b-(y-ymin)/(ymax-ymin)*(H-p.t-p.b);
  const ns='http://www.w3.org/2000/svg';
  
  function el(tag,attrs,text=''){
    const e=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);
    if(text)e.textContent=text;
    svg.appendChild(e);
    return e;
  }

  const groundPts=d.map(pt=>`${sx(pt.x)},${sy(pt.y)}`).join(' ');
  el('polyline',{points:groundPts,class:'ground'});
  el('line',{x1:sx(xmin),y1:sy(w),x2:sx(xmax),y2:sy(w),class:'water'});

  // Draw bank station reference markers
  [normalDepth.leftBank, normalDepth.rightBank].forEach(bankX => {
    if (Number.isFinite(bankX)) {
      el('line',{x1: sx(bankX), y1: sy(ymin), x2: sx(bankX), y2: sy(ymax), stroke:'#ff6b6b', 'stroke-width':'1.5', 'stroke-dasharray':'4 4'});
    }
  });

  for(let i=0;i<=5;i++){const y=ymin+(ymax-ymin)*i/5;const yy=sy(y);el('line',{x1:p.l,y1:yy,x2:W-p.r,y2:yy,class:'axis-tick'});el('text',{x:8,y:yy+4,class:'axis-text'},y.toFixed(0));}
  for(let i=0;i<=5;i++){const x=xmin+(xmax-xmin)*i/5;const xx=sx(x);el('line',{x1:xx,y1:p.t,x2:xx,y2:H-p.b,class:'axis-tick'});el('text',{x:xx-12,y:H-15,class:'axis-text'},x.toFixed(0));}
  el('text',{x:W/2,y:H-2,class:'axis-label','text-anchor':'middle'},'Station (ft)');
  el('text',{x:13,y:H/2,class:'axis-label',transform:`rotate(-90 13 ${H/2})`},'Elevation (ft)');
}

function solve(){
  normalDepth.slope=parseFloat($('slope').value);
  normalDepth.n_lob=parseFloat($('n_lob').value);
  normalDepth.n_ch=parseFloat($('n_ch').value);
  normalDepth.n_rob=parseFloat($('n_rob').value);
  normalDepth.q=parseFloat($('q').value);
  normalDepth.wse=parseFloat($('wse').value)||normalDepth.wse;
  normalDepth.leftBank=parseFloat($('leftBank').value);
  normalDepth.rightBank=parseFloat($('rightBank').value);

  const mode=$('solvetype').value;
  const r=solveAndReport({
    slope:normalDepth.slope,
    n_lob:normalDepth.n_lob,
    n_ch:normalDepth.n_ch,
    n_rob:normalDepth.n_rob,
    q:normalDepth.q,
    wse:normalDepth.wse,
    xsData:normalDepth.XSData,
    leftBank:normalDepth.leftBank,
    rightBank:normalDepth.rightBank,
    solveFor:mode
  });

  normalDepth.slope=r.slope;
  normalDepth.q=r.q;
  normalDepth.wse=r.wse;

  $('slope').value=f(normalDepth.slope,6);$('n_ch').value=f(normalDepth.n_ch,3);
  $('n_lob').value=f(normalDepth.n_lob,3);$('n_rob').value=f(normalDepth.n_rob,3);
  $('leftBank').value=f(normalDepth.leftBank,2);$('rightBank').value=f(normalDepth.rightBank,2);
  $('q').value=f(normalDepth.q,3);$('wse').value=f(normalDepth.wse,2);

  $('wseR').textContent=f(r.wse,2);$('depth').textContent=f(r.depth,2);
  $('area').textContent=f(r.flowArea,1);$('wetP').textContent=f(r.wetP,1);
  $('topWidth').textContent=f(r.topWidth,1);$('avgVel').textContent=f(r.avgVel,2);
  $('froude').textContent=f(r.froude,2);$('iterations').textContent=r.iterations;
  $('calcQ').textContent=f(r.q,1);$('hydRadius').textContent=f(r.flowArea/r.wetP,2);
  renderPlot();
}

$('calculate').onclick=solve;
$('reset').onclick=()=>{
  normalDepth.XSData=defaultData.map(p=>({...p}));
  $('xsInput').value=normalDepth.XSData.map(p=>`${p.x}\t${p.y}`).join('\n');
  solve();
};
$('applyData').onclick=()=>{
  const d=parseData($('xsInput').value);
  if(d.length<2){alert('At least two points are required.');return}
  normalDepth.XSData=d;
  solve();
};
$('fileInput').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{$('xsInput').value=r.result};
  r.readAsText(file);
};

$('xsInput').value=normalDepth.XSData.map(p=>`${p.x}\t${p.y}`).join('\n');
$('slope').value=normalDepth.slope;
$('n_lob').value=normalDepth.n_lob;
$('n_ch').value=normalDepth.n_ch;
$('n_rob').value=normalDepth.n_rob;
$('leftBank').value=normalDepth.leftBank;
$('rightBank').value=normalDepth.rightBank;
$('q').value=normalDepth.q;
$('wse').value=normalDepth.wse;
solve();