import { Router } from 'express';
import { Client, Lead } from '../db.js';

const r = Router();

// POST /leads { slug, name, phone, email, service, sessionId }  (SIY-9 builds on this)
r.post('/', async (req, res) => {
  try {
    const { slug, ...data } = req.body;
    const client = await Client.findOne({ slug });
    if (!client) return res.status(404).json({ error: 'client not found' });
    const lead = await Lead.create({ clientId: client._id, ...data });
    // TODO SIY-9: email notification to client.notifyEmail
    res.json({ ok: true, id: lead._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /leads/:slug  → for the monthly report
r.get('/:slug', async (req, res) => {
  const client = await Client.findOne({ slug: req.params.slug });
  if (!client) return res.status(404).json({ error: 'client not found' });
  res.json(await Lead.find({ clientId: client._id }).sort({ createdAt: -1 }).lean());
});

export default r;
