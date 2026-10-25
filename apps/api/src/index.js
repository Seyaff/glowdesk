import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { connectDb } from './db.js';
import clients from './routes/clients.js';
import chat from './routes/chat.js';
import leads from './routes/leads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors()); // widget runs on client sites, so allow all origins
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_, res) => res.json({ ok: true, llm: config.llmProvider }));
app.use('/clients', clients);
app.use('/chat', chat);
app.use('/leads', leads);

// serve the embeddable widget: <script src="https://API/bx.js" data-client="slug">
app.use(express.static(path.join(__dirname, '../../widget')));

await connectDb(config.mongoUri);
app.listen(config.port, () => console.log(`API on http://localhost:${config.port}`));
