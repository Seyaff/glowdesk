import { google } from 'googleapis';

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth });
const profile = await gmail.users.getProfile({ userId: 'me' });
const email = profile.data.emailAddress;

const message = [
  `To: ${email}`,
  'Subject: GlowDesk draft integration test',
  'Content-Type: text/plain; charset=UTF-8',
  '',
  'This is a test draft created by GlowDesk. No email has been sent.'
].join('\r\n');

const raw = Buffer.from(message)
  .toString('base64url');

const result = await gmail.users.drafts.create({
  userId: 'me',
  requestBody: {
    message: { raw }
  }
});

console.log('Draft created successfully:', result.data.id);
console.log('Open Gmail > Drafts to view it.');
