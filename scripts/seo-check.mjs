// Fetches the public pages from a running server and checks what a crawler sees in the
// first HTML response, before any JavaScript runs: title, description, canonical, hreflang,
// one h1, JSON-LD, and the page's main text. Usage: node scripts/seo-check.mjs http://localhost:3000
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const slugs = [
  'how-to-bid-on-a-public-tender-in-romania',
  'register-in-seap-and-get-a-digital-signature',
  'duae-espd-explained',
  'qualification-requirements-in-construction-tenders',
  'common-mistakes-first-time-bidders',
  'tender-consultant-vs-software',
];
const paths = ['', '/pricing', '/about', '/contact', '/privacy', '/terms', '/resources', ...slugs.map((s) => `/resources/${s}`)];
let bad = 0;
const fail = (url, msg) => {
  bad++;
  console.log(`FAIL ${url}: ${msg}`);
};
for (const locale of ['en', 'ro']) {
  for (const p of paths) {
    const url = `${base}/${locale}${p}`;
    const res = await fetch(url);
    const html = await res.text();
    if (res.status !== 200) {
      fail(url, `status ${res.status}`);
      continue;
    }
    const get = (re) => html.match(re)?.[1];
    if (!get(/<title>([^<]+)<\/title>/)) fail(url, 'no <title>');
    if (!get(/<meta name="description" content="([^"]+)"/)) fail(url, 'no meta description');
    if (!get(/<link rel="canonical" href="([^"]+)"/)) fail(url, 'no canonical');
    if (!/hrefLang="en"/i.test(html) || !/hrefLang="ro"/i.test(html)) fail(url, 'missing hreflang alternates');
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fail(url, `${h1} <h1> elements`);
    if (!html.includes('application/ld+json')) fail(url, 'no JSON-LD');
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const min = p === '/contact' ? 40 : 120;
    if (text.split(' ').length < min) fail(url, `less than ${min} words of text in the first HTML`);
    if (!new RegExp(`<html[^>]*lang="${locale}"`).test(html)) fail(url, 'wrong <html lang>');
  }
}
for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']) {
  const r = await fetch(base + f);
  if (r.status !== 200) fail(f, `status ${r.status}`);
}
console.log(bad ? `${bad} problem(s)` : 'SEO check passed');
process.exit(bad ? 1 : 0);
