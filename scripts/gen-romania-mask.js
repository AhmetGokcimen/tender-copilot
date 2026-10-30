// Writes lib/romania-mask.ts from Natural Earth borders.
// Run with world-atlas@2 and topojson-client@3 installed.
const topo=require('world-atlas/countries-10m.json');
const {feature}=require('topojson-client');
const ro=feature(topo,topo.objects.countries).features.find(f=>f.id==='642');
const polys=ro.geometry.type==='Polygon'?[ro.geometry.coordinates]:ro.geometry.coordinates;
const inRing=(x,y,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
const inside=(x,y)=>polys.some(p=>inRing(x,y,p[0])&&!p.slice(1).some(h=>inRing(x,y,h)));
let minX=99,maxX=0,minY=99,maxY=0;for(const p of polys)for(const[x,y]of p[0]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
const W=1000,H=704,step=9,cols=Math.floor(W/step),rows=Math.floor(H/step);
const bits=[];let n=0;
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=step/2+c*step,y=step/2+r*step;const on=inside(minX+x/W*(maxX-minX),maxY-y/H*(maxY-minY));bits.push(on?1:0);n+=on;}
const bytes=Buffer.alloc(Math.ceil(bits.length/8));bits.forEach((b,i)=>{if(b)bytes[i>>3]|=1<<(i&7)});
const out=`/**
 * Romania as a dot grid: one bit per ${step}px cell of a ${W}x${H} box
 * (${cols} columns x ${rows} rows, row-major, LSB first), from Natural Earth
 * borders. Regenerate with scripts/gen-romania-mask.js.
 */
export const ROMANIA_GRID = { cols: ${cols}, rows: ${rows}, step: ${step}, width: ${W}, height: ${H} };
export const ROMANIA_MASK = '${bytes.toString('base64')}';
`;
require('fs').writeFileSync(require('path').join(__dirname,'../lib/romania-mask.ts'),out);
console.log(cols,rows,n,bytes.length);
