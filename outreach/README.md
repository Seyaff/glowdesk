# GlowDesk outreach worker (Windows)

This is a first-pass prototype. It discovers US med spas through Apify, checks publicly visible emails, creates GlowDesk demos on Render, and creates **Gmail drafts only**. It never sends messages. Run a small test before scaling. The scraper actor's input/output fields may change; confirm them in Apify Console. This prototype does not enforce an Apify dollar cap; use the Actor's own spending controls and small result limits.

## Setup
1. Install Node.js 22+ and Git for Windows.
2. Copy this directory into your cloned `glowdesk` repository as `outreach/`.
3. Open PowerShell in `outreach/` and run `npm install`.
4. Run `Copy-Item .env.example .env` and edit `.env` locally. Never commit `.env`.
5. Set `APIFY_TOKEN`, `GLOWDESK_ADMIN_KEY`, and the search terms. Start with `APIFY_MAX_RESULTS=10` and `DRY_RUN=true`.
6. Run `npm run run`. This spends Apify credits and creates Render demos, but no Gmail drafts.
7. To enable Gmail drafts, create a Google Cloud project, enable Gmail API, configure an OAuth consent screen and a Desktop application OAuth client. Set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env`. Add your Gmail as a test user if needed.
8. Run `npm run gmail:auth`; open the displayed URL, authorize Gmail compose access, and put the returned `GMAIL_REFRESH_TOKEN` in `.env`. Do not share the token.
9. Set `DRY_RUN=false`, then `npm run run` to create drafts. Check Gmail Drafts.

## Drafts from saved previews

From the repository root, run the local tests (mocked Gmail and demo HTTP; no credentials or network needed):

```powershell
npm run test:outreach
```

Preview the first eligible draft without creating it, even when `.env` has `DRY_RUN=false`:

```powershell
npm run drafts:from-previews -- --dry-run --limit=1
```

This reads `outreach/outreach-state.json`, checks demo links with read-only HTTP GET requests, and prints the proposed recipient, link, subject, and body. It does not change state, call Apify, ingest websites, or send email. A working link means an HTTP success returning HTML at `/demo.html` with a nonempty `client` parameter; this does not verify assistant responses. Only `preview` records with a valid email qualify. Saved `name` and `website` fields are used when present; older records use their domain as the name and website fallback.

After explicitly approving real draft creation, use this command in PowerShell from the repository root:

```powershell
$env:DRY_RUN = 'false'
npm run drafts:from-previews -- --limit=1
Remove-Item Env:DRY_RUN
```

Omit `--limit=1` to process all eligible previews. Dry run is the default unless `DRY_RUN=false`; `--dry-run` always overrides it. Only Gmail OAuth credentials are needed for real creation; no Apify or GlowDesk admin credentials are required. From inside `outreach/`, the same `npm run drafts:from-previews -- ...` command works.

Successful drafts persist `status: drafted` and `draftId` immediately. Before calling Gmail, the worker persists `status: drafting` and `draftAttemptedAt`; an uncertain API result is never retried automatically. Inspect Gmail manually before recovering such records: store the existing draft ID and mark drafted if found. Only restore preview status and remove the attempt marker after confirming no draft exists. A `.drafts.lock` file blocks concurrent preview workers. If a process is forcibly terminated, verify it is stopped before removing the stale lock. Do not run the discovery worker concurrently against the same state file. Keep state, lock files, and credentials local.

## Notes
- Do not share any passwords, OAuth tokens, or admin keys in chat or GitHub.
- A working website and a syntactically valid email do not establish deliverability or consent.
- This is an initial proof of concept, not a 400/day production system. Add verified lead enrichment, opt-out suppression, robust retry queues, source compliance checks, and demo QA before scaling.
- Current state file `outreach-state.json` contains prospect details and must remain private.
- The generated message is a transparent template, not AI-personalized copy yet.
