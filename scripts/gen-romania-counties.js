// Writes lib/romania-counties.ts: which county each dot of the Romania dot grid belongs to.
// Usage: node scripts/gen-romania-counties.js <gadm41_ROU_1.json>
// Run with world-atlas@2 and topojson-client@3 installed (same bbox as gen-romania-mask.js).
const fs = require('fs');
const path = require('path');
const topo = require('world-atlas/countries-10m.json');
const { feature } = require('topojson-client');
const ro = feature(topo, topo.objects.countries).features.find((f) => f.id === '642');
const polys0 = ro.geometry.type === 'Polygon' ? [ro.geometry.coordinates] : ro.geometry.coordinates;
let minX = 99, maxX = 0, minY = 99, maxY = 0;
for (const p of polys0) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const W = 1000, H = 704, step = 9, cols = Math.floor(W / step), rows = Math.floor(H / step);

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ºª]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const COUNTIES = ['Alba','Arad','Argeș','Bacău','Bihor','Bistrița-Năsăud','Botoșani','Brăila','Brașov','București','Buzău','Călărași','Caraș-Severin','Cluj','Constanța','Covasna','Dâmbovița','Dolj','Galați','Giurgiu','Gorj','Harghita','Hunedoara','Ialomița','Iași','Ilfov','Maramureș','Mehedinți','Mureș','Neamț','Olt','Prahova','Sălaj','Satu Mare','Sibiu','Suceava','Teleorman','Timiș','Tulcea','Vâlcea','Vaslui','Vrancea'];
const alias = { bucharest: 'București', bucuresti: 'București', caraşseverin: 'Caraș-Severin' };
const g = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const shapes = [];
for (const f of g.features) {
  const n = norm(f.properties.NAME_1);
  const name = alias[n] || COUNTIES.find((c) => norm(c) === n);
  if (!name) { console.error('UNMATCHED', f.properties.NAME_1); continue; }
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  shapes.push({ idx: COUNTIES.indexOf(name), polys });
}
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (x, y, p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h));
const distSeg = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const nearest = (x, y) => { let best = -1, bd = Infinity; for (const s of shapes) for (const p of s.polys) { const r = p[0]; for (let i = 1; i < r.length; i++) { const d = distSeg(x, y, r[i - 1], r[i]); if (d < bd) { bd = d; best = s.idx; } } } return best; };

const mask = fs.readFileSync(path.join(__dirname, '../lib/romania-mask.ts'), 'utf8').match(/ROMANIA_MASK = '([^']+)'/)[1];
const bytes = Buffer.from(mask, 'base64');
let out = '', miss = 0;
for (let i = 0; i < cols * rows; i++) {
  if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
  const x = step / 2 + (i % cols) * step, y = step / 2 + Math.floor(i / cols) * step;
  const lon = minX + (x / W) * (maxX - minX), lat = maxY - (y / H) * (maxY - minY);
  let idx = -1;
  for (const s of shapes) if (s.polys.some((p) => inPoly(lon, lat, p))) { idx = s.idx; break; }
  if (idx < 0) { idx = nearest(lon, lat); miss++; }
  out += String.fromCharCode(48 + idx);
}
fs.writeFileSync(path.join(__dirname, '../lib/romania-counties.ts'), `/**
 * County of each dot of the Romania dot grid (same order as the set bits of
 * ROMANIA_MASK): one character per dot, char code - 48 = index in COUNTIES.
 * From GADM level-1 borders. Regenerate with scripts/gen-romania-counties.js.
 */
export const DOT_COUNTY = '${out}';
`);
console.log('dots', out.length, 'filled by nearest', miss, 'counties', shapes.length);
