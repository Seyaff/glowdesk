import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true }, // e.g. "glow-med-spa"
    name: String,
    website: String,
    bookingUrl: String,
    brandColor: { type: String, default: '#111827' },
    notifyEmail: String,
    status: { type: String, enum: ['demo', 'pilot', 'paying', 'churned'], default: 'demo' },
  },
  { timestamps: true }
);

const chunkSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
  url: String,
  text: String,
  embedding: [Number],
});

const leadSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
    name: String,
    phone: String,
    email: String,
    service: String,
    sessionId: String,
  },
  { timestamps: true }
);
// one lead per chat session (SIY-9); partial so older leads without a sessionId don't collide
leadSchema.index(
  { clientId: 1, sessionId: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: 'string' } } }
);

export const Client = mongoose.model('Client', clientSchema);
export const Chunk = mongoose.model('Chunk', chunkSchema);
export const Lead = mongoose.model('Lead', leadSchema);

export async function connectDb(uri) {
  await mongoose.connect(uri);
  console.log('Mongo connected');
}
