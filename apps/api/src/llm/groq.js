import { config } from '../config.js';

// Groq is OpenAI-compatible. Chat only — embeddings still go through Gemini.
export async function chat({ system, messages }) {
  const { apiKey, chatModel } = config.groq;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: chatModel,
      temperature: 0.3,
      max_tokens: 400,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Groq chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
