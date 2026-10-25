import * as cheerio from 'cheerio';

// Starter crawler for SIY-6: same-domain BFS, prioritises pages that matter to a med spa.
const PRIORITY = /(service|treatment|pricing|price|menu|faq|about|contact|botox|filler|facial|laser|book)/i;
const SKIP = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3)(\?|$)|\/wp-(admin|json)|#/i;

export async function crawlSite(startUrl, maxPages = 25) {
  const origin = new URL(startUrl).origin;
  const queue = [startUrl];
  const seen = new Set();
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BuildonyxBot/0.1)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) continue;

      const $ = cheerio.load(await res.text());
      $('script, style, noscript, svg, iframe, nav, footer').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) pages.push({ url, text });

      const links = [];
      $('a[href]').each((_, el) => {
        try {
          const href = new URL($(el).attr('href'), url);
          href.hash = '';
          const clean = href.toString();
          if (href.origin === origin && !SKIP.test(clean) && !seen.has(clean)) links.push(clean);
        } catch {}
      });
      // important pages first
      links.sort((a, b) => Number(PRIORITY.test(b)) - Number(PRIORITY.test(a)));
      queue.push(...links);
    } catch (e) {
      console.warn('crawl fail', url, e.message);
    }
  }
  return pages;
}

export function chunkText(text, size = 1200, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks;
}
