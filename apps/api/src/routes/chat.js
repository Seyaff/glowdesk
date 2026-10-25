import { Router } from 'express';
import { Client } from '../db.js';
import { retrieve } from '../lib/retrieve.js';
import { captureLead } from '../lib/leads.js';
import { chat } from '../llm/index.js';

const r = Router();

const systemPrompt = (client, context, leadSaved) => `You are the friendly front-desk assistant for ${client.name || 'this med spa'}.
Answer ONLY using the website information below. Keep replies short (2-4 sentences), warm and helpful.

Rules:
- Never invent prices, treatments, staff names or hours. If it's not in the info, say you'll have the team follow up.
- No medical advice or diagnoses; suggest a consultation instead.
- When the visitor shows interest in a treatment, offer to book${client.bookingUrl ? ` (booking link: ${client.bookingUrl})` : ''} or ask for their name and phone so the team can reach out.
- ${
  leadSaved
    ? 'The visitor has shared their contact details and they have been passed to the team. You may confirm that.'
    : 'The visitor has NOT shared a phone number or email yet. Never say you have noted, saved or received their contact details.'
}
- Never promise a specific callback time (e.g. "within an hour", "today"). Just say the team will reach out.

Website information:
${context}`;

// POST /chat { slug, sessionId, messages: [{role, content}] }
r.post('/', async (req, res) => {
  try {
    const { slug, sessionId, messages = [] } = req.body;
    const client = await Client.findOne({ slug }).lean();
    if (!client) return res.status(404).json({ error: 'client not found' });

    const last = messages.filter((m) => m.role === 'user').at(-1)?.content;
    if (!last) return res.status(400).json({ error: 'no user message' });

    // SIY-9: lead capture runs first so the reply only confirms details that were actually saved.
    const lead = await captureLead({ client, sessionId, messages }).catch((e) => {
      console.error('[lead] capture failed:', e.message);
      return null;
    });

    const hits = await retrieve(client._id, last, 5);
    const context = hits.map((h) => `[${h.url}]\n${h.text}`).join('\n\n');
    const reply = await chat({ system: systemPrompt(client, context, !!lead), messages: messages.slice(-10) });

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'chat failed' });
  }
});

export default r;
