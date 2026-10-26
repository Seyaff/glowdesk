import { Router } from 'express';
import { Client, Chunk } from '../db.js';
import { crawlSite, chunkText } from '../lib/crawl.js';
import { embed, useEmbeddings } from '../llm/index.js';
import { config } from '../config.js';
import { requireAdmin } from '../lib/auth.js';

const r = Router();

// Create a client (or demo) from a website. Ali's demo generator calls this.
// POST /clients { name, website, slug?, bookingUrl?, notifyEmail? }
r.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, website, bookingUrl, notifyEmail } = req.body;
    if (!website) return res.status(400).json({ error: 'website required' });
    const slug =
      req.body.slug ||
      (name || new URL(website).hostname).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const client = await Client.findOneAndUpdate(
      { slug },
      { name, website, bookingUrl, ...(notifyEmail !== undefined && { notifyEmail }) },
      { upsert: true, new: true }
    );
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crawl + embed the client's site (SIY-6)
// POST /clients/:slug/ingest
r.post('/:slug/ingest', requireAdmin, async (req, res) => {
  try {
    const client = await Client.findOne({ slug: req.params.slug });
    if (!client) return res.status(404).json({ error: 'client not found' });

    const pages = await crawlSite(client.website, config.crawlMaxPages);
    await Chunk.deleteMany({ clientId: client._id });

    const docs = [];
    for (const page of pages) {
      for (const text of chunkText(page.text)) {
        // embeddings only if EMBED_PROVIDER=gemini; default keyword search needs none
        const embedding = useEmbeddings() ? await embed(text) : [];
        docs.push({ clientId: client._id, url: page.url, text, embedding });
      }
    }
    if (docs.length) await Chunk.insertMany(docs);
    const count = docs.length;
    res.json({ slug: client.slug, pages: pages.length, chunks: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.get('/:slug', async (req, res) => {
  const client = await Client.findOne({ slug: req.params.slug }).lean();
  if (!client) return res.status(404).json({ error: 'not found' });
  res.json({ name: client.name, brandColor: client.brandColor, bookingUrl: client.bookingUrl });
});

export default r;
