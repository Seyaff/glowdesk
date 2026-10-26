const env = process.env;

export const config = {
  port: Number(env.PORT || 4000),
  mongoUri: env.MONGODB_URI,
  llmProvider: env.LLM_PROVIDER || 'groq',
  embedProvider: env.EMBED_PROVIDER || 'none', // none = keyword search | gemini = vector search
  gemini: {
    apiKey: env.GEMINI_API_KEY,
    chatModel: env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    embedModel: env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
  },
  groq: {
    apiKey: env.GROQ_API_KEY,
    chatModel: env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
  },
  vectorSearch: env.VECTOR_SEARCH || 'local',
  crawlMaxPages: Number(env.CRAWL_MAX_PAGES || 25),
  adminKey: env.ADMIN_KEY,
};

if (!config.mongoUri) {
  console.error('MONGODB_URI missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!config.adminKey) {
  console.error('ADMIN_KEY missing. Set it in .env (a long random string) — admin endpoints require it. Refusing to start.');
  process.exit(1);
}
