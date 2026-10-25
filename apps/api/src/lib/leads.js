import nodemailer from 'nodemailer';
import { Lead } from '../db.js';
import { chat } from '../llm/index.js';

// SIY-9: detect contact details in the chat, save one Lead per session, email the client once.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Loose candidate match, then keep 10-15 digits: covers (555) 123-4567, 555.123.4567, +1 555 123 4567,
// +92 300 1234567, 0300-1234567. Dates and prices have too few digits to pass.
const PHONE_RE = /\+?\(?\d[\d \t().-]{7,}\d/g;

// Only scan what the visitor typed — assistant replies may quote the spa's own phone/email.
export function detectContact(messages) {
  const text = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const phones = (text.match(PHONE_RE) || []).map((p) => p.trim()).filter((p) => {
    const digits = p.replace(/\D/g, '').length;
    return digits >= 10 && digits <= 15;
  });
  const emails = text.match(EMAIL_RE) || [];
  return { phone: phones.at(-1) || null, email: emails.at(-1)?.toLowerCase() || null };
}

const EXTRACT_PROMPT = `Extract the website visitor's contact details from this med spa chat.
Return ONLY a JSON object, no other text: {"name": string|null, "phone": string|null, "email": string|null, "service": string|null}
- name/phone/email: only what the VISITOR said about themselves, never the business's details.
- service: the treatment they are interested in, if any.
- Use null for anything not stated. Do not guess.`;

function parseJson(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

const clean = (v) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : null);

async function extractLead(messages, found) {
  const transcript = messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`).join('\n');
  let data = null;
  try {
    data = parseJson(await chat({ system: EXTRACT_PROMPT, messages: [{ role: 'user', content: transcript }] }));
  } catch (e) {
    console.error('[lead] extraction failed, using regex values:', e.message);
  }
  return {
    name: clean(data?.name),
    phone: clean(data?.phone) || found.phone,
    email: clean(data?.email) || found.email,
    service: clean(data?.service),
  };
}

// Returns the saved lead, or null if the conversation has no phone/email yet.
export async function captureLead({ client, sessionId, messages }) {
  const found = detectContact(messages);
  if (!found.phone && !found.email) return null;
  if (!sessionId) {
    console.warn('[lead] contact details found but no sessionId; not saved');
    return null;
  }

  const fields = await extractLead(messages, found);
  // Only $set known values so a later turn can't blank out what we already have.
  const $set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
  const res = await Lead.findOneAndUpdate(
    { clientId: client._id, sessionId },
    { $set },
    { upsert: true, new: true, includeResultMetadata: true }
  );
  const lead = res.value;
  const isNew = !res.lastErrorObject?.updatedExisting;

  if (isNew) {
    // Fire-and-forget: email problems must never break the chat reply.
    notifyClient(client, lead, messages).catch((e) => console.error('[lead] email failed:', e.message));
  }
  return lead;
}

let transport;
function mailer() {
  const { GMAIL_USER: user, GMAIL_APP_PASSWORD: pass } = process.env;
  if (!user || !pass) return null;
  transport ||= nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return transport;
}

async function notifyClient(client, lead, messages) {
  if (!client.notifyEmail) return console.log(`[lead] ${client.slug}: no notifyEmail set, skipping email`);
  const t = mailer();
  if (!t) return console.log('[lead] GMAIL_USER/GMAIL_APP_PASSWORD not set, skipping email');

  const convo = messages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content}`)
    .join('\n\n');
  const text = `New lead from your website chat

Name:    ${lead.name || '-'}
Phone:   ${lead.phone || '-'}
Email:   ${lead.email || '-'}
Service: ${lead.service || '-'}

Conversation (last 10 messages):

${convo}`;

  await t.sendMail({
    from: `"${client.name || 'Website chat'}" <${process.env.GMAIL_USER}>`,
    to: client.notifyEmail,
    replyTo: lead.email || undefined,
    subject: `New lead from your website chat: ${lead.name || 'Unknown'}`,
    text,
  });
  console.log(`[lead] emailed ${client.notifyEmail} for lead ${lead._id}`);
}
