import { config } from '../config.js';
import * as gemini from './gemini.js';
import * as groq from './groq.js';

const chatProviders = { gemini, groq };

// Swap providers in .env — no code changes.
export function chat(args) {
  const p = chatProviders[config.llmProvider];
  if (!p) throw new Error(`Unknown LLM_PROVIDER: ${config.llmProvider}`);
  return p.chat(args);
}

// Embeddings are optional. Default 'none' = keyword (BM25) search, no API key needed.
export const useEmbeddings = () => config.embedProvider === 'gemini';
export const embed = (text) => gemini.embed(text);
