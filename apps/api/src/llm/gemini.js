import { config } from '../config.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// messages: [{ role: 'user' | 'assistant', content: string }]
export async function chat({ system, messages }) {
  const { apiKey, chatModel } = config.gemini;
  const res = await fetch(`${BASE}/${chatModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}

export async function embed(text) {
  const { apiKey, embedModel } = config.gemini;
  const res = await fetch(`${BASE}/${embedModel}:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}
