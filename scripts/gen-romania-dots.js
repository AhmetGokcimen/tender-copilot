// Generates public/brand/romania-dots.svg from Natural Earth borders.
// Run from a folder with world-atlas@2 and topojson-client@3 installed.
const topo=require('world-atlas/countries-10m.json');
const {feature}=require('topojson-client');
const fc=feature(topo,topo.objects.countries);
const ro=fc.features.find(f=>f.id==='642'||f.properties.name==='Romania');
const polys=ro.geometry.type==='Polygon'?[ro.geometry.coordinates]:ro.geometry.coordinates;
const inRing=(x,y,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
const inside=(x,y)=>polys.some(p=>inRing(x,y,p[0])&&!p.slice(1).some(h=>inRing(x,y,h)));
let minX=99,maxX=0,minY=99,maxY=0;for(const p of polys)for(const[x,y]of p[0]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
const k=Math.cos(46*Math.PI/180);
const W=1000, H=Math.round(W*(maxY-minY)/((maxX-minX)*k));
const px=(lon,lat)=>[ (lon-minX)/(maxX-minX)*W, (maxY-lat)/(maxY-minY)*H ];
const step=9; let out=[];
// deterministic jitter
let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
for(let y=step/2;y<H;y+=step)for(let x=step/2;x<W;x+=step){
  const lon=minX+x/W*(maxX-minX), lat=maxY-y/H*(maxY-minY);
  if(!inside(lon,lat)) continue;
  const r=(1.2+rnd()*1.5).toFixed(1);
  const t=x/W; // gradient left->right
  out.push(`<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${r}" opacity="${(0.35+rnd()*0.55).toFixed(1)}"/>`);
}
const cities={Bucharest:[44.43,26.10],Cluj:[46.77,23.59],Timisoara:[45.75,21.23],Iasi:[47.16,27.59],Constanta:[44.18,28.65],Brasov:[45.65,25.60],Craiova:[44.32,23.80],Galati:[45.44,28.05],Oradea:[47.07,21.92],Sibiu:[45.79,24.15],Arad:[46.18,21.31],Ploiesti:[44.94,26.02],Bacau:[46.57,26.91],Suceava:[47.65,26.26],Pitesti:[44.86,24.87],BaiaMare:[47.66,23.58],TarguMures:[46.54,24.56],AlbaIulia:[46.07,23.58],Deva:[45.88,22.90],Buzau:[45.15,26.82],DrobetaTS:[44.63,22.66],Tulcea:[45.18,28.80]};
const pos={};for(const[n,[la,lo]]of Object.entries(cities)){const[x,y]=px(lo,la);pos[n]=[+(x/W*100).toFixed(2),+(y/H*100).toFixed(2)];}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f5c45"/><stop offset=".6" stop-color="#4f9a76"/><stop offset="1" stop-color="#d4a72c"/></linearGradient></defs><g fill="url(#g)">${out.join('')}</g></svg>`;
// gradient on group with userSpaceOnUse
const svg2=svg.replace('<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',`<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">`);
require('fs').writeFileSync('romania-dots.svg',svg2);
console.log(out.length,W,H,JSON.stringify(pos));
