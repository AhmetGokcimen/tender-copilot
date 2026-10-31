// Runs from .github/workflows/social-publisher.yml. Finds today's entry in
// social/schedule.json and publishes its carousel to the Licits Instagram account
// through the Meta Graph API. The images are served from this repo via
// raw.githubusercontent.com, so the repo has to stay public. The result is written
// back into schedule.json so the workflow can commit it and a post never goes out twice.
//
// Same flow as the Otonomica publisher (Automation Website repo), Instagram only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const IG_USER_ID = process.env.META_IG_USER_ID;

const SCHEDULE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'social', 'schedule.json');

// Posts go out at 08:45 Europe/Bucharest. GitHub cron only knows UTC, so the workflow
// fires at both 05:45 and 06:45 UTC and this guard lets only the run at or after 08:45 local through.
const PUBLISH_HOUR = 8;
const PUBLISH_MINUTE = 45;

function bucharestNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${m.year}-${m.month}-${m.day}`, minutes: Number(m.hour) * 60 + Number(m.minute) };
}

async function graph(method, endpoint, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: ACCESS_TOKEN });
  const res = await fetch(method === 'GET' ? `${GRAPH_BASE}/${endpoint}?${query}` : `${GRAPH_BASE}/${endpoint}`, {
    method,
    body: method === 'GET' ? undefined : query,
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Graph API error on ${endpoint}: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilFinished(containerId, { attempts = 12, intervalMs = 5000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const { status_code: status } = await graph('GET', containerId, { fields: 'status_code' });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`IG media container ${containerId} ended with status ${status}.`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`IG media container ${containerId} did not finish processing in time.`);
}

// Meta fetches each image itself, so a 404 here would surface as a vague container error.
async function assertReachable(urls) {
  for (const url of urls) {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`Image not reachable (${res.status}): ${url}. Is the branch merged and the repo public?`);
  }
}

async function publishCarousel(entry) {
  await assertReachable(entry.mediaUrls);

  const childIds = [];
  for (const url of entry.mediaUrls) {
    const { id } = await graph('POST', `${IG_USER_ID}/media`, { image_url: url, is_carousel_item: 'true' });
    childIds.push(id);
  }
  const { id: creationId } = await graph('POST', `${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: entry.caption,
  });
  await waitUntilFinished(creationId);
  const { id: mediaId } = await graph('POST', `${IG_USER_ID}/media_publish`, { creation_id: creationId });
  return mediaId;
}

// Posts nothing. Checks that the token reaches the account, that the account may publish
// and that every image still scheduled can be fetched. Run it from the workflow with verify=true.
async function verify(schedule) {
  const account = await graph('GET', IG_USER_ID, { fields: 'username,media_count' });
  console.log(`Token reaches @${account.username} (${account.media_count} posts so far).`);

  const limit = await graph('GET', `${IG_USER_ID}/content_publishing_limit`, { fields: 'quota_usage,config' });
  const { quota_usage: used, config } = limit.data?.[0] || {};
  console.log(`Publishing quota: ${used ?? '?'} of ${config?.quota_total ?? '?'} used in the last 24 hours.`);

  for (const entry of schedule.filter((e) => e.instagramStatus !== 'published')) {
    await assertReachable(entry.mediaUrls);
    console.log(`${entry.date} ${entry.folder}: ${entry.mediaUrls.length} images reachable, caption ${entry.caption.length} characters.`);
  }
  console.log('Verify finished. Nothing was published.');
}

async function main() {
  if (!ACCESS_TOKEN || !IG_USER_ID) {
    console.error('FATAL: META_PAGE_ACCESS_TOKEN and META_IG_USER_ID must both be set.');
    process.exit(1);
  }

  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  if (process.env.VERIFY === 'true') {
    await verify(schedule);
    return;
  }
  const now = bucharestNow();
  const forced = Boolean(process.env.TARGET_DATE);
  const today = process.env.TARGET_DATE || now.date;
  console.log(`Target date: ${today}${forced ? ' (manual override)' : ' (Europe/Bucharest today)'}`);

  const entry = schedule.find((e) => e.date === today);
  if (!entry) {
    console.log('No post scheduled for today. Exiting cleanly.');
    return;
  }
  if (entry.instagramStatus === 'published') {
    console.log('Instagram already published for this entry, skipping.');
    return;
  }
  if (!forced && now.minutes < PUBLISH_HOUR * 60 + PUBLISH_MINUTE) {
    console.log('Before 08:45 Europe/Bucharest, waiting for the next run.');
    return;
  }

  console.log(`Publishing ${entry.folder} (${entry.mediaUrls.length} slides)...`);
  try {
    entry.instagramMediaId = await publishCarousel(entry);
    entry.instagramStatus = 'published';
    delete entry.instagramError;
    try {
      const { permalink } = await graph('GET', entry.instagramMediaId, { fields: 'permalink' });
      entry.instagramPermalink = permalink;
    } catch (err) {
      console.error('Could not fetch the permalink:', err.message);
    }
    console.log(`Instagram published: ${entry.instagramMediaId}`);
  } catch (err) {
    console.error('Instagram publish failed:', err.message);
    entry.instagramStatus = 'error';
    entry.instagramError = err.message;
    process.exitCode = 1;
  }

  entry.lastAttemptAt = new Date().toISOString();
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
}

main().catch((err) => {
  console.error('Social publisher encountered a fatal error:', err);
  process.exit(1);
});
