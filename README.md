# Buildonyx

AI front-desk chatbot for med spa websites. Zero-budget stack: Gemini/Groq free tiers, MongoDB Atlas free, Render/Vercel free.

```
apps/
  api/      Node + Express: crawl → embed → RAG chat, leads   (Siyaf)
  widget/   bx.js — one script tag on the client's site    (Siyaf)
  web/      Next.js: demo pages + dashboard (create below)     (later)
```

## Setup (5 min)

1. **MongoDB Atlas** → free M0 cluster → copy connection string.
2. **Gemini key** → https://aistudio.google.com/apikey (free). Optional: Groq key → https://console.groq.com/keys
3. Install + run:
```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in MONGODB_URI + GEMINI_API_KEY + ADMIN_KEY
npm run dev:api
```
4. Check: `curl http://localhost:4000/health`

## Admin key
`POST /clients`, `POST /clients/:slug/ingest` and everything under `/leads` need the
`x-admin-key` header (value = `ADMIN_KEY` from `.env`), otherwise they return `401 {"error":"unauthorized"}`.
Public (the widget uses them): `POST /chat`, `GET /clients/:slug`, `/health`, `bx.js`, `demo.html`.

## Make a demo bot for a med spa (end-to-end test)

```bash
# 1. create client (admin)
curl -X POST localhost:4000/clients -H "Content-Type: application/json" -H "x-admin-key: YOUR_KEY" \
  -d '{"name":"Glow Med Spa","website":"https://example-medspa.com","notifyEmail":"owner@example.com"}'
# → returns slug, e.g. "glow-med-spa"

# 2. crawl + embed their site (admin)
curl -X POST localhost:4000/clients/glow-med-spa/ingest -H "x-admin-key: YOUR_KEY"

# 3. chat (public, no key)
curl -X POST localhost:4000/chat -H "Content-Type: application/json" \
  -d '{"slug":"glow-med-spa","messages":[{"role":"user","content":"How much is Botox?"}]}'

# 4. see leads (admin)
curl localhost:4000/leads/glow-med-spa -H "x-admin-key: YOUR_KEY"

# 5. see the widget
open http://localhost:4000/demo.html?client=glow-med-spa
```

Same in PowerShell (Windows):
```powershell
$api = "http://localhost:4000"
$admin = @{ "x-admin-key" = "YOUR_KEY" }

# 1. create client (admin)
Invoke-RestMethod -Method Post -Uri "$api/clients" -Headers $admin -ContentType "application/json" `
  -Body (@{ name = "Glow Med Spa"; website = "https://example-medspa.com"; notifyEmail = "owner@example.com" } | ConvertTo-Json)

# 2. crawl + embed (admin)
Invoke-RestMethod -Method Post -Uri "$api/clients/glow-med-spa/ingest" -Headers $admin

# 3. chat (public, no key)
Invoke-RestMethod -Method Post -Uri "$api/chat" -ContentType "application/json" `
  -Body (@{ slug = "glow-med-spa"; messages = @(@{ role = "user"; content = "How much is Botox?" }) } | ConvertTo-Json -Depth 5)

# 4. see leads (admin)
Invoke-RestMethod -Uri "$api/leads/glow-med-spa" -Headers $admin
```

**Ali's demo generator (SIY-17)** = loop over the lead sheet calling step 1 + 2, then write
`https://YOUR_API/demo.html?client=<slug>` back into the sheet.

## Switching LLM
`LLM_PROVIDER=gemini` or `groq` in `.env`. No code change. Embeddings stay on Gemini.

## Atlas vector search (optional, later)
`VECTOR_SEARCH=local` works fine for demos. When a client has lots of pages, create an Atlas
Vector Search index named `chunk_vector_index` on collection `chunks`:
```json
{ "fields": [
  { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
  { "type": "filter", "path": "clientId" }
]}
```
(Set `numDimensions` to whatever your embedding model returns: check `embedding.length` on one chunk.)
Then set `VECTOR_SEARCH=atlas`.

## Next.js app (apps/web)
```bash
cd apps && npx create-next-app@latest web --ts --tailwind --app --eslint
```
Used later for the nicer demo pages + client dashboard. Not needed for the first demos.

## Deploy (free)
- API + widget → Render free web service (root: `apps/api`, start: `npm start`, add env vars)
- Free tier sleeps after inactivity → first message after sleep is slow. Fine for demos, upgrade with first client money.

## Ticket map
| Ticket | Where |
|---|---|
| SIY-5 repo/structure | this scaffold |
| SIY-6 crawler | `api/src/lib/crawl.js`, `POST /clients/:slug/ingest` |
| SIY-7 chat RAG | `api/src/routes/chat.js`, `lib/retrieve.js` |
| SIY-8 widget | `apps/widget/bx.js` |
| SIY-9 lead capture | `api/src/routes/leads.js` (+ wire into widget + email) |
| SIY-10 booking | `bookingUrl` on client, already in system prompt |
