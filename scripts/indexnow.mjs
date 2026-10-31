// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) about every URL in the sitemap.
// Usage: node scripts/indexnow.mjs [siteUrl]
const KEY = '61d90f0a92837e2f778ca0e56a86e5bd';
const site = (process.argv[2] || 'https://licits.com').replace(/\/$/, '');

const xml = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error('No URLs found in sitemap');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: new URL(site).host,
    key: KEY,
    keyLocation: `${site}/${KEY}.txt`,
    urlList,
  }),
});
console.log(`IndexNow: ${urlList.length} URLs, HTTP ${res.status}`);
if (res.status >= 300) process.exit(1);
