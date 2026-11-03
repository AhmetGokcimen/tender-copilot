import json, datetime
now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
edit = {"via": "claude", "at": now}
comps = [("licits","Licits (biz)"),("datadriven","DataDriven.ro"),("licitatia","Licitatia.ro"),("licitatiepublica","Licitatie-publica.ro"),("jorpex","Jorpex"),("sicapai","sicap.ai"),("sicappro","sicap.pro")]
feats = [("alerts","E-posta uyarısı"),("filters","CPV / il / değer filtresi"),("summary","AI özet"),("eligibility","AI yeterlilik kontrolü"),("draft","Teklif / DUAE taslağı"),("winners","Önceki kazananlar"),("ocr","Taranmış PDF okuma"),("api","API / MCP")]

matrix = "<thead><tr><th>Rakip</th>" + "".join(f"<th>{l}</th>" for _,l in feats) + "</tr></thead><tbody>"
for cid, cn in comps:
    matrix += f"<tr><th scope='row'>{cn}</th>" + "".join(
        f'<td class="lx-cell" data-draw="cell" data-source="features" data-field="level" data-where="competitor_id={cid}&amp;feature={f}">—</td>' for f,_ in feats) + "</tr>"
matrix += "</tbody>"

def table(src, key, cols, name):
    head = "".join(f'<th data-field="{f}">{l}</th>' for f,l in cols)
    return f'<div class="lx-scroll"><table class="lx-table" data-source="{src}" data-row-key="{key}" aria-label="{name}"><thead><tr>{head}</tr></thead><tbody data-draw="tbl"></tbody></table></div>'

def num(src, field, row=0):
    return f'<b class="lx-num" data-draw="num" data-source="{src}" data-field="{field}" data-row="{row}">—</b>'

swot_cols = [("text","Bulgu"),("evidence","Kanıt")]
html = f"""<meta name="dash-one-writer">
<style>
#dash-root {{ --dash-gutter: clamp(12px, 3vw, 32px); }}
.lx {{ max-width: 1120px; margin-inline: auto; font-family: var(--font-anthropic-sans); color: var(--color-fg); display: flex; flex-direction: column; gap: var(--cds-gap-xl); }}
.lx h1 {{ font-family: var(--font-anthropic-serif); font-weight: 400; font-size: clamp(1.6rem, 4vw, 2.2rem); margin: 0; text-wrap: balance; }}
.lx h2 {{ font-size: var(--cds-font-size-heading); font-weight: var(--cds-font-weight-medium); margin: 0; }}
.lx p {{ margin: 0; }}
.lx-take {{ color: var(--color-fg-muted); max-width: 70ch; margin-top: var(--cds-gap-sm); }}
.lx-nav {{ display: flex; flex-wrap: wrap; gap: var(--cds-gap-xs); margin-top: var(--cds-gap-md); }}
.lx-nav button {{ font: inherit; font-size: var(--cds-font-size-caption); color: var(--color-fg); background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: 999px; padding: 4px 12px; cursor: pointer; }}
.lx-nav button:hover {{ border-color: var(--color-fg-muted); }}
.lx-nav button:focus-visible {{ outline: 2px solid var(--color-fg); outline-offset: 2px; }}
.lx-tiles {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--cds-gap-md); }}
.lx-tile {{ background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); padding: var(--cds-pad-lg); display: flex; flex-direction: column; gap: var(--cds-gap-xs); min-width: 0; }}
.lx-tile .lx-label {{ color: var(--color-fg-muted); font-size: var(--cds-font-size-caption); }}
.lx-tile .lx-big {{ font-family: var(--font-anthropic-serif); font-size: var(--cds-font-size-title); font-weight: 400; font-variant-numeric: tabular-nums; }}
.lx-num {{ font-weight: 400; font-variant-numeric: tabular-nums; }}
.lx-tile .lx-sub {{ color: var(--color-fg-muted); font-size: var(--cds-font-size-caption); }}
.lx-sec {{ display: flex; flex-direction: column; gap: var(--cds-gap-md); scroll-margin-top: 12px; }}
.lx-sec > .lx-note {{ color: var(--color-fg-muted); max-width: 75ch; }}
.lx-card {{ background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); padding: var(--cds-pad-lg); display: flex; flex-direction: column; gap: var(--cds-gap-sm); min-width: 0; }}
.lx-card h3 {{ margin: 0; font-size: var(--cds-font-size-body); font-weight: var(--cds-font-weight-medium); }}
.lx-grid2 {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: var(--cds-gap-md); }}
.lx-scroll {{ overflow-x: auto; max-width: 100%; }}
.lx-table {{ border-collapse: collapse; width: 100%; font-size: var(--cds-font-size-caption); }}
.lx-table th, .lx-table td {{ text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--color-border-line); }}
.lx-table th {{ color: var(--color-fg-muted); font-weight: var(--cds-font-weight-medium); white-space: nowrap; }}
.lx-table td {{ min-width: 7rem; font-variant-numeric: tabular-nums; }}
.lx-table td a {{ color: var(--color-fg-muted); word-break: break-all; }}
.lx-table td[data-tone=ok] {{ color: var(--color-ok); }}
.lx-table td[data-tone=warn] {{ color: var(--color-warn); }}
.lx-table td[data-tone=bad] {{ color: var(--color-bad); }}
.lx-table td[data-tone=muted] {{ color: var(--color-fg-muted); }}
.lx-heat {{ border-collapse: separate; border-spacing: 3px; width: 100%; font-size: var(--cds-font-size-caption); }}
.lx-heat th {{ font-weight: var(--cds-font-weight-medium); text-align: left; padding: 6px 8px; color: var(--color-fg-muted); vertical-align: bottom; }}
.lx-heat th[scope=row] {{ color: var(--color-fg); white-space: nowrap; }}
.lx-cell {{ text-align: center; padding: 10px 6px; border-radius: 6px; background: color-mix(in srgb, var(--color-fg-muted) 10%, transparent); color: var(--color-fg-muted); min-width: 5.5rem; }}
.lx-cell[data-tone=ok] {{ background: color-mix(in srgb, var(--color-ok) 16%, transparent); color: var(--color-ok); }}
.lx-cell[data-tone=warn] {{ background: color-mix(in srgb, var(--color-warn) 16%, transparent); color: var(--color-warn); }}
.lx-cell[data-tone=bad] {{ background: color-mix(in srgb, var(--color-bad) 14%, transparent); color: var(--color-bad); }}
.lx-chart {{ min-height: 120px; width: 100%; }}
.lx-chart svg {{ display: block; max-width: 100%; }}
.lx-foot {{ color: var(--color-fg-muted); font-size: var(--cds-font-size-caption); }}
[data-dash-source-state=refreshing] {{ opacity: .5; transition: opacity var(--cds-dur-slow); }}
</style>

<div class="lx">
<header>
  <h1>Licits rakip paneli</h1>
  <p class="lx-take">En yakın rakip DataDriven.ro: yeterlilik kontrolünü ve AI teklif hazırlığını bizden daha ucuza satıyor. Licits'in farkı gerekçeli kontrol, önceki kazanan verisi ve ANAF'tan otomatik profil.</p>
  <nav class="lx-nav" aria-label="Bölümler">
    <button type="button" data-go="ozet">Özet</button><button type="button" data-go="fiyat">Fiyat</button><button type="button" data-go="ozellik">Özellikler</button><button type="button" data-go="konum">Konumlandırma</button><button type="button" data-go="mesaj">Mesajlaşma</button><button type="button" data-go="swot">SWOT</button><button type="button" data-go="kalip">Kalıplar</button><button type="button" data-go="taktik">Taktikler</button><button type="button" data-go="kaynak">Kaynaklar</button>
  </nav>
</header>

<section class="lx-sec" id="ozet">
  <div class="lx-tiles">
    <div class="lx-tile"><span class="lx-label">İncelenen rakip</span><span class="lx-big">{num('summary','competitor_count')}</span><span class="lx-sub">Romanya kamu ihalesi izleme araçları</span></div>
    <div class="lx-tile"><span class="lx-label">Giriş planı, RON/ay</span><span class="lx-big">{num('summary','licits_entry')} <span class="lx-sub">Licits</span> · {num('summary','dd_entry')} <span class="lx-sub">DataDriven</span></span><span class="lx-sub">KDV hariç</span></div>
    <div class="lx-tile"><span class="lx-label">Giriş planı fiyat farkı</span><span class="lx-big">×{num('summary','entry_ratio')}</span><span class="lx-sub">Licits / DataDriven</span></div>
    <div class="lx-tile"><span class="lx-label">Tam sunduğu özellik</span><span class="lx-big">{num('summary','licits_full')} <span class="lx-sub">Licits</span> · {num('summary','dd_full')} <span class="lx-sub">DataDriven</span></span><span class="lx-sub">Toplam özellik sayısı: {num('summary','features_total')}</span></div>
  </div>
  <div class="lx-card">
    <h3>Tehdit sıralaması</h3>
    <p class="lx-note lx-foot">Güven sütunu, bilginin ne kadar doğrulandığını gösterir: Yüksek = sitenin kendisinden okundu, Düşük = ikinci el.</p>
    {table('competitors','id',[('name','Rakip'),('segment','Tür'),('pricing','Fiyat'),('trial','Deneme'),('threat','Tehdit'),('threat_reason','Neden'),('confidence','Güven')],'Rakip tehdit tablosu')}
  </div>
</section>

<section class="lx-sec" id="fiyat">
  <h2>Fiyat</h2>
  <p class="lx-note">Aylık RON, KDV hariç. Açık renkli uzantı, Licitatia.ro sayfasındaki ikinci fiyattır.</p>
  <div class="lx-card"><h3>Planlar yan yana</h3><div class="lx-chart" data-draw="price-chart" data-source="plans"></div></div>
  <div class="lx-card"><h3>Kademe kademe: Licits ve DataDriven</h3>
    {table('tier_gap','tier',[('tier','Kademe'),('licits_plan','Licits planı'),('licits_price','Licits RON'),('licits_users','Licits kullanıcı'),('dd_plan','DataDriven planı'),('dd_price','DataDriven RON'),('dd_users','DataDriven kullanıcı'),('ratio','Fiyat farkı ×')],'Kademe fiyat farkı')}
  </div>
  <div class="lx-card"><h3>Fiyat kaynakları ve notlar</h3>
    {table('plans','id',[('competitor','Rakip'),('plan','Plan'),('price_ron','RON/ay'),('price_ron_high','Üst fiyat'),('users','Kullanıcı'),('note','Not')],'Plan tablosu')}
  </div>
</section>

<section class="lx-sec" id="ozellik">
  <h2>Özellik karşılaştırması</h2>
  <p class="lx-note">Bilinmiyor, sayfada bulamadığım demektir ve tahmin değildir. Hücrenin üstüne gelince kanıt notu çıkar.</p>
  <div class="lx-card"><div class="lx-scroll"><table class="lx-heat" aria-label="Özellik matrisi">{matrix}</table></div></div>
</section>

<section class="lx-sec" id="konum">
  <h2>Konumlandırma haritası</h2>
  <p class="lx-note">Yatay: özelliklerin kaçına 'Var' denebildiği. Dikey: en ucuz planın aylık fiyatı. Bilinmeyen özellikler puanı düşürür. Fiyatı açıklanmayan Licitatie-publica.ro ve sicap.pro haritada yer almaz.</p>
  <div class="lx-card"><div class="lx-chart" data-draw="pos-chart" data-source="positioning"></div></div>
</section>

<section class="lx-sec" id="mesaj">
  <h2>Mesajlaşma</h2>
  <p class="lx-note">Başlıklar sitelerden olduğu gibi alındı.</p>
  <div class="lx-card">
    {table('competitors','id',[('name','Rakip'),('headline','Başlık'),('value_prop','Vaat'),('proof','Kanıt'),('cta','Çağrı'),('tone','Ton')],'Mesajlaşma tablosu')}
  </div>
</section>

<section class="lx-sec" id="swot">
  <h2>Licits için SWOT</h2>
  <div class="lx-grid2">
    <div class="lx-card"><h3>Güçlü yönler</h3>{table('swot_strength','id',swot_cols,'Güçlü yönler')}</div>
    <div class="lx-card"><h3>Zayıf yönler</h3>{table('swot_weakness','id',swot_cols,'Zayıf yönler')}</div>
    <div class="lx-card"><h3>Fırsatlar</h3>{table('swot_opportunity','id',swot_cols,'Fırsatlar')}</div>
    <div class="lx-card"><h3>Tehditler</h3>{table('swot_threat','id',swot_cols,'Tehditler')}</div>
  </div>
</section>

<section class="lx-sec" id="kalip">
  <h2>Rakiplerde çalışan kalıplar ve boşluklar</h2>
  <p class="lx-note">Reklam kütüphaneleri bu çalışmada incelenemedi. Kalıplar sitelerden ve basındaki yazılardan çıkarıldı.</p>
  <div class="lx-grid2">
    <div class="lx-card"><h3>Çalışan kalıplar</h3>{table('patterns','id',swot_cols,'Çalışan kalıplar')}</div>
    <div class="lx-card"><h3>Boşluklar</h3>{table('gaps','id',swot_cols,'Boşluklar')}</div>
  </div>
</section>

<section class="lx-sec" id="taktik">
  <h2>Kopyalanabilir taktikler</h2>
  <div class="lx-card">
    {table('tactics','id',[('source','Kimden'),('tactic','Taktik'),('why','Neden işe yarıyor'),('for_licits','Licits için'),('effort','Efor'),('impact','Etki')],'Taktikler')}
  </div>
</section>

<section class="lx-sec" id="kaynak">
  <h2>Kaynaklar ve sınırlar</h2>
  <p class="lx-note">'Yapılmadı' satırları Meta, LinkedIn ve Google reklam kütüphaneleridir: tarayıcı oturumu gerektirdiği için bu çalışmada taranmadı, bu yüzden reklam envanteri ve harcama tahmini yok. 'İkinci el' satırlar sitenin kendisi okunamadığı için üçüncü taraf kaynaktan alındı.</p>
  <div class="lx-card">
    {table('sources','id',[('title','Kaynak'),('url','Adres'),('used_for','Ne için'),('status','Durum')],'Kaynaklar')}
  </div>
</section>
</div>

<script>
const TONES = {{
  threat: {{'Yüksek':'bad','Orta':'warn','Düşük':'ok'}},
  effort: {{'Düşük':'ok','Orta':'warn','Yüksek':'bad'}},
  impact: {{'Yüksek':'ok','Orta':'warn','Düşük':'muted'}},
  confidence: {{'Yüksek':'ok','Orta':'warn','Düşük':'bad'}},
  status: {{'okundu':'ok','ikinci el':'warn','yalnızca arama sonucu':'warn','engellendi (403)':'bad','yapılmadı':'bad'}}
}};
const LEVEL_TONE = {{'Var':'ok','Kısmi':'warn','Yok':'bad','Bilinmiyor':'muted'}};

dash.calc('swot_strength', {{inputs: ['insights'], title: 'Güçlü yönler', description: 'Insights tablosundaki güçlü yön satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Güçlü yön')}});
dash.calc('swot_weakness', {{inputs: ['insights'], title: 'Zayıf yönler', description: 'Insights tablosundaki zayıf yön satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Zayıf yön')}});
dash.calc('swot_opportunity', {{inputs: ['insights'], title: 'Fırsatlar', description: 'Insights tablosundaki fırsat satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Fırsat')}});
dash.calc('swot_threat', {{inputs: ['insights'], title: 'Tehditler', description: 'Insights tablosundaki tehdit satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Tehdit')}});
dash.calc('patterns', {{inputs: ['insights'], title: 'Çalışan kalıplar', description: 'Insights tablosundaki çalışan kalıp satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Çalışan kalıp')}});
dash.calc('gaps', {{inputs: ['insights'], title: 'Boşluklar', description: 'Insights tablosundaki boşluk satırları.', fn: (insights) => insights.filter((r) => r.kind === 'Boşluk')}});

dash.calc('summary', {{
  inputs: ['competitors', 'plans', 'features'],
  title: 'Özet rakamlar',
  description: 'Rakip sayısı, giriş fiyatları ve tam sunulan özellik sayıları.',
  fn: (competitors, plans, features) => {{
    const entry = (id) => Math.min(...plans.filter((p) => p.competitor_id === id).map((p) => p.price_ron));
    const full = (id) => features.filter((f) => f.competitor_id === id && f.level === 'Var').length;
    return [{{
      id: 'summary',
      competitor_count: competitors.length - 1,
      licits_entry: entry('licits'),
      dd_entry: entry('datadriven'),
      entry_ratio: Math.round(entry('licits') / entry('datadriven') * 10) / 10,
      licits_full: full('licits'),
      dd_full: full('datadriven'),
      features_total: features.filter((f) => f.competitor_id === 'licits').length
    }}];
  }}
}});

dash.calc('tier_gap', {{
  inputs: ['plans'],
  title: 'Kademe fiyat farkı',
  description: 'Licits ve DataDriven planları ucuzdan pahalıya eşleştirilir; fark = Licits fiyatı / DataDriven fiyatı.',
  fn: (plans) => {{
    const lic = plans.filter((p) => p.competitor_id === 'licits');
    const dd = plans.filter((p) => p.competitor_id === 'datadriven');
    const names = ['Giriş', 'Orta', 'Üst'];
    return lic.map((l, i) => ({{
      tier: names[i], licits_plan: l.plan, licits_price: l.price_ron, licits_users: l.users,
      dd_plan: dd[i].plan, dd_price: dd[i].price_ron, dd_users: dd[i].users,
      ratio: Math.round(l.price_ron / dd[i].price_ron * 10) / 10
    }}));
  }}
}});

dash.calc('positioning', {{
  inputs: ['competitors', 'plans', 'features'],
  title: 'Konumlandırma puanları',
  description: 'Özellik payı = Var denen özellik sayısı / toplam özellik (yüzde). Giriş fiyatı = en ucuz plan.',
  fn: (competitors, plans, features) => competitors.map((c) => {{
    const mine = features.filter((f) => f.competitor_id === c.id);
    const prices = plans.filter((p) => p.competitor_id === c.id).map((p) => p.price_ron);
    return {{
      id: c.id, name: c.name,
      share: Math.round(mine.filter((f) => f.level === 'Var').length / mine.length * 100),
      entry_price: prices.length ? Math.min(...prices) : null
    }};
  }})
}});

dash.draw('num', (el) => {{
  const d = dash.data(el.dataset.source);
  if (d.status !== 'ok') {{ el.textContent = '—'; return; }}
  const r = d.data[Number(el.dataset.row) || 0];
  const v = r ? r[el.dataset.field] : null;
  el.textContent = v == null ? '—' : String(v);
}});

dash.draw('tbl', (body) => {{
  const table = body.closest('table');
  const d = dash.data(table.dataset.source);
  if (d.status !== 'ok') {{ body.replaceChildren(); return; }}
  const cols = [...table.querySelectorAll('thead th')].map((th) => th.dataset.field);
  const key = table.dataset.rowKey;
  const frag = document.createDocumentFragment();
  for (const row of d.data) {{
    const tr = document.createElement('tr');
    tr.dataset.key = String(row[key]);
    for (const c of cols) {{
      const td = document.createElement('td');
      const txt = row[c] == null ? '—' : String(row[c]);
      if (c === 'url' && /^https?:\\/\\//.test(txt)) {{
        const a = document.createElement('a');
        a.href = txt; a.target = '_blank'; a.rel = 'noopener'; a.textContent = txt;
        td.append(a);
      }} else {{
        td.textContent = txt;
      }}
      const tone = (TONES[c] || {{}})[txt];
      if (tone) td.dataset.tone = tone;
      tr.append(td);
    }}
    frag.append(tr);
  }}
  body.replaceChildren(frag);
}});

dash.draw('cell', (el) => {{
  const d = dash.data(el.dataset.source);
  if (d.status !== 'ok') {{ el.textContent = '—'; el.removeAttribute('data-tone'); el.removeAttribute('title'); return; }}
  const p = new URLSearchParams(el.dataset.where);
  const r = d.data.find((x) => x.competitor_id === p.get('competitor_id') && x.feature === p.get('feature'));
  el.textContent = r ? r.level : '—';
  if (r) {{ el.dataset.tone = LEVEL_TONE[r.level] || 'muted'; el.title = r.note || ''; }}
  else {{ el.removeAttribute('data-tone'); el.removeAttribute('title'); }}
}});

const NS_TICK = 'font-size: var(--cds-font-size-caption); fill: var(--color-fg-muted);';
const fillFor = (id, i) => id === 'licits' ? dash.colors[0] : id === 'datadriven' ? dash.colors[1] : 'var(--cds-chart-muted)';

dash.draw('price-chart', (el) => {{
  const d = dash.data('plans');
  if (d.status !== 'ok') {{ el.replaceChildren(); return; }}
  const rows = d.data;
  const W = Math.max(320, el.clientWidth || 640);
  const rowH = 28, top = 8, bottom = 30, right = 84;
  const H = top + rows.length * rowH + bottom;
  el.replaceChildren();
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${{W}} ${{H}}`).attr('role', 'img').attr('aria-label', 'Plan fiyatları, RON/ay');
  const probe = svg.append('text').attr('style', NS_TICK);
  let widest = 0;
  for (const r of rows) {{ probe.text(r.competitor + ' · ' + r.plan); widest = Math.max(widest, probe.node().getComputedTextLength()); }}
  probe.remove();
  const left = Math.ceil(widest) + 14;
  const maxV = d3.max(rows, (r) => r.price_ron_high) || 1;
  const x = d3.scaleLinear([0, maxV], [left, W - right]).nice();
  for (const t of x.ticks(5)) {{
    svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', top).attr('y2', H - bottom).style('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('text').attr('x', x(t)).attr('y', H - bottom + 16).attr('text-anchor', 'middle').attr('style', NS_TICK).text(d3.format(',')(t));
  }}
  rows.forEach((r, i) => {{
    const y = top + i * rowH;
    if (i > 0 && rows[i - 1].competitor_id !== r.competitor_id) {{
      svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 1).attr('stroke-dasharray', '2 3');
    }}
    svg.append('text').attr('x', left - 8).attr('y', y + rowH / 2 + 4).attr('text-anchor', 'end').attr('style', 'font-size: var(--cds-font-size-caption); fill: var(--color-fg);').text(r.competitor + ' · ' + r.plan);
    const base = fillFor(r.competitor_id);
    if (r.price_ron_high > r.price_ron) {{
      svg.append('rect').attr('x', x(r.price_ron)).attr('y', y + 5).attr('width', Math.max(0, x(r.price_ron_high) - x(r.price_ron))).attr('height', rowH - 10).attr('rx', 3).style('fill', base).attr('opacity', 0.35);
    }}
    svg.append('rect').attr('x', left).attr('y', y + 5).attr('width', Math.max(2, x(r.price_ron) - left)).attr('height', rowH - 10).attr('rx', 3).style('fill', base);
    const label = r.price_ron_high > r.price_ron ? r.price_ron + '–' + r.price_ron_high : String(r.price_ron);
    svg.append('text').attr('x', x(r.price_ron_high) + 8).attr('y', y + rowH / 2 + 4).attr('style', 'font-size: var(--cds-font-size-caption); fill: var(--color-fg); font-variant-numeric: tabular-nums;').text(label);
  }});
  svg.append('line').attr('x1', left).attr('x2', left).attr('y1', top).attr('y2', H - bottom).style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 1);
}});

dash.draw('pos-chart', (el) => {{
  const d = dash.data('positioning');
  if (d.status !== 'ok') {{ el.replaceChildren(); return; }}
  const pts = d.data.filter((r) => r.entry_price != null);
  const W = Math.max(320, el.clientWidth || 640), H = 380;
  const m = {{ left: 56, right: 24, top: 16, bottom: 48 }};
  el.replaceChildren();
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${{W}} ${{H}}`).attr('role', 'img').attr('aria-label', 'Özellik payı ve giriş fiyatı');
  const x = d3.scaleLinear([0, 100], [m.left, W - m.right]);
  const maxY = d3.max(pts, (r) => r.entry_price) || 1;
  const y = d3.scaleLinear([0, maxY * 1.15], [H - m.bottom, m.top]).nice();
  for (const t of y.ticks(5)) {{
    svg.append('line').attr('x1', m.left).attr('x2', W - m.right).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('text').attr('x', m.left - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('style', NS_TICK).text(d3.format(',')(t));
  }}
  for (const t of [0, 25, 50, 75, 100]) {{
    svg.append('text').attr('x', x(t)).attr('y', H - m.bottom + 18).attr('text-anchor', 'middle').attr('style', NS_TICK).text(t + '%');
  }}
  svg.append('line').attr('x1', m.left).attr('x2', W - m.right).attr('y1', H - m.bottom).attr('y2', H - m.bottom).style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 1);
  svg.append('text').attr('x', (m.left + W - m.right) / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('style', NS_TICK).text('Tam sunulan özellik payı');
  svg.append('text').attr('transform', `translate(14 ${{(m.top + H - m.bottom) / 2}}) rotate(-90)`).attr('text-anchor', 'middle').attr('style', NS_TICK).text('Giriş fiyatı, RON/ay');
  for (const r of pts) {{
    const cx = x(r.share), cy = y(r.entry_price);
    const mine = r.id === 'licits';
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', mine ? 9 : 7).style('fill', fillFor(r.id));
    const right = r.share > 70;
    svg.append('text').attr('x', right ? cx - 14 : cx + 14).attr('y', cy + 4).attr('text-anchor', right ? 'end' : 'start').attr('style', 'font-size: var(--cds-font-size-caption); fill: var(--color-fg);' + (mine ? ' font-weight: 600;' : '')).text(r.name);
  }}
}});

document.querySelectorAll('.lx-nav button').forEach((b) => {{
  b.addEventListener('click', () => {{
    const t = document.getElementById(b.dataset.go);
    if (t) {{ t.scrollIntoView({{behavior: 'smooth', block: 'start'}}); dash.setLink(t.id); }}
  }});
}});
</script>
"""
open("index.html","w").write(html)

ds = {
 "competitors": ("Rakip profilleri","Rakip adı, fiyatı, vaadi, kanıtı ve tehdit değerlendirmesi. Sitelerden okundu; sicap.ai ve sicap.pro ikinci el."),
 "plans": ("Plan fiyatları","Rakip ve Licits planları, RON/ay, KDV hariç. Jorpex 1 EUR = 5 RON varsayımıyla çevrildi."),
 "features": ("Özellik matrisi","Rakip başına 8 özellik: Var, Kısmi, Yok, Bilinmiyor. Not sütunu kanıtı söyler."),
 "tactics": ("Kopyalanabilir taktikler","Rakiplerden alınabilecek taktikler, Licits için uyarlama, efor ve etki (benim değerlendirmem)."),
 "insights": ("SWOT, kalıplar, boşluklar","Licits için bulgular: güçlü/zayıf yön, fırsat, tehdit, çalışan kalıp, boşluk. Kanıt sütunu kaynağı söyler."),
 "sources": ("Kaynaklar ve durumları","Kullanılan veya denenen kaynaklar ve okunabildi mi."),
}
urls = {
 "competitors":"/_blob/8b8d8d2de90b235d129a4bdfc2568321","plans":"/_blob/4be41cafd782bce434090d5821908ad3",
 "features":"/_blob/8be4138a5717d057e6b3af3c3f7e76cc","tactics":"/_blob/439f0733a89e3c16e8b89ee51ab39998",
 "insights":"/_blob/6aa84a7f19fe3bf73a0620c1f8d95508","sources":"/_blob/90176cea1448d4095da8173aaa757c44"}
writes=[{"op":"set","collection":"dash","doc_id":"meta","data":{"title":"Licits rakip paneli"}}]
for k,(t,desc) in ds.items():
    writes.append({"op":"set","collection":"datasets","doc_id":k,"data":{"title":t,"description":desc,"source":{"kind":"file","url":urls[k],"name":k+".json","format":"json"},"updated":{"at":now,"by":"claude"},"fixed":True,"edit":edit}})
json.dump({"text":html,"edit":edit},open("page_doc.json","w"),ensure_ascii=False)
writes.append({"op":"set","collection":"files","doc_id":"index.html","file_path":"/tmp/claude-0/-home-user-tender-copilot/71c47923-257d-5e69-afbf-31da915280ce/scratchpad/lens/page_doc.json"})
json.dump(writes,open("writes.json","w"),ensure_ascii=False)
print(len(html), len(writes))
