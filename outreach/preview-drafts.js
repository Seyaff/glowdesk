import fs from 'node:fs';

const validEmail = value => typeof value === 'string' && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
function demoURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/demo.html' && url.searchParams.get('client') ? url : null;
  } catch { return null; }
}

export async function draftsFromPreviews({statePath, compose, draft, args = process.argv.slice(2), env = process.env, fetchImpl = fetch, gmailFactory, log = console.log}) {
  const dry = args.includes('--dry-run') || env.DRY_RUN !== 'false';
  const limitArgs = args.filter(arg => arg.startsWith('--limit='));
  if (args.some(arg => !['--from-previews', '--dry-run'].includes(arg) && !arg.startsWith('--limit=')) || limitArgs.length > 1 || (limitArgs.length && !/^[1-9]\d*$/.test(limitArgs[0].slice(8)))) throw Error('Invalid arguments');
  const limit = limitArgs.length ? Number(limitArgs[0].slice(8)) : Infinity;
  if (limit !== Infinity && !Number.isSafeInteger(limit)) throw Error('Invalid limit');
  // A separate lock prevents overlapping workers from drafting the same preview.
  const lockPath = `${statePath}.drafts.lock`;
  const lock = fs.openSync(lockPath, 'wx');
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const save = () => {
      fs.writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2));
      fs.renameSync(`${statePath}.tmp`, statePath);
    };
    let count = 0;
    let gmail;
    log(dry ? 'DRY RUN: no drafts or state changes' : 'CREATE DRAFTS ONLY');
    for (const [domain, record] of Object.entries(state)) {
      if (count >= limit) break;
      if (!record || record.status !== 'preview' || record.draftId || record.draftAttemptedAt || !validEmail(record.email)) continue;
      const url = demoURL(record.link);
      if (!url) { log('SKIP invalid demo link', domain); continue; }
      try {
        const response = await fetchImpl(url.href, {method: 'GET', signal: AbortSignal.timeout(20000)});
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !/<html[\s>]/i.test(await response.text())) {
          log('SKIP unavailable demo', domain); continue;
        }
      } catch { log('SKIP unavailable demo', domain); continue; }
      const {subject, body} = compose(String(record.name || domain).replace(/[\r\n]/g, ' '), record.website || `https://${domain}`, url.href);
      if (dry) { log('WOULD DRAFT', JSON.stringify({domain, email: record.email, link: url.href, subject, body})); count++; continue; }
      if (!gmail) {
        if (gmailFactory) gmail = await gmailFactory();
        else {
          if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) throw Error('Missing Gmail credentials');
          const {google} = await import('googleapis');
          const auth = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
          auth.setCredentials({refresh_token: env.GMAIL_REFRESH_TOKEN});
          gmail = google.gmail({version: 'v1', auth});
        }
      }
      // Persist before the API call: a lost response must never cause an automatic duplicate.
      record.status = 'drafting';
      record.draftAttemptedAt = new Date().toISOString();
      save();
      try {
        const result = await draft(gmail, record.email, subject, body);
        if (!result.data?.id) throw Error('Missing draft ID');
        record.draftId = result.data.id;
        record.status = 'drafted';
        save();
      } catch {
        log('Draft outcome uncertain; inspect Gmail and local state before manual recovery.', domain);
        throw Error('Draft creation interrupted');
      }
      log('DRAFT', domain);
      count++;
    }
    log(`Finished: ${count} ${dry ? 'planned drafts' : 'drafts'}`);
    return count;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}
