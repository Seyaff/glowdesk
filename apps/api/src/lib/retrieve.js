import { config } from '../config.js';
import { Chunk } from '../db.js';
import { embed, useEmbeddings } from '../llm/index.js';

const STOP = new Set('a an the is are was were be to of in on for and or with at by from it its this that do does you your we our i my me can how what when where which who much many any have has'.split(' '));

export const tokenize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9$\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

// BM25 keyword ranking — no API, works great on small sites
function bm25(query, chunks, k = 5) {
  const q = tokenize(query);
  if (!q.length) return chunks.slice(0, k);
  const docs = chunks.map((c) => tokenize(c.text));
  const N = docs.length;
  const avg = docs.reduce((s, d) => s + d.length, 0) / (N || 1);
  const df = {};
  for (const d of docs) for (const w of new Set(d)) df[w] = (df[w] || 0) + 1;

  return chunks
    .map((c, i) => {
      const d = docs[i];
      const tf = {};
      for (const w of d) tf[w] = (tf[w] || 0) + 1;
      let score = 0;
      for (const w of q) {
        if (!tf[w]) continue;
        const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
        score += idf * ((tf[w] * 2.2) / (tf[w] + 1.2 * (1 - 0.75 + (0.75 * d.length) / avg)));
      }
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function retrieve(clientId, query, k = 5) {
  const chunks = await Chunk.find({ clientId }).lean();
  if (!useEmbeddings()) return bm25(query, chunks, k);

  const qv = await embed(query);
  if (config.vectorSearch === 'atlas') {
    return Chunk.aggregate([
      { $vectorSearch: { index: 'chunk_vector_index', path: 'embedding', queryVector: qv, numCandidates: 100, limit: k, filter: { clientId } } },
      { $project: { text: 1, url: 1 } },
    ]);
  }
  return chunks
    .map((c) => ({ ...c, score: cosine(qv, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
