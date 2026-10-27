import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {draftsFromPreviews} from './preview-drafts.js';
import {compose, draft} from './pipeline.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-drafts-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const statePath = path.join(dir, 'state.json');
  const preview = {status: 'preview', email: 'hello@example.org', link: 'https://demo.example.org/demo.html?client=example'};
  fs.writeFileSync(statePath, JSON.stringify({failed: {...preview, status: 'failed'}, invalid: {...preview, email: 'bad\r\nBcc: x@y.org'}, drafted: {...preview, draftId: 'existing'}, broken: {...preview, link: 'https://demo.example.org/demo.html?client=broken'}, first: {...preview}, second: {...preview}}));
  const calls = [];
  const gmail = {users: {drafts: {create: async input => {calls.push(input); return {data: {id: `draft-${calls.length}`}};}}}};
  const options = {statePath, compose, draft, args: ['--limit=1'], env: {DRY_RUN: 'false'}, log: () => {}, gmailFactory: () => gmail, fetchImpl: async url => new Response('<html>demo</html>', {status: url.includes('broken') ? 404 : 200, headers: {'content-type': 'text/html'}})};
  return {options, calls, statePath};
}

test('filters previews, limits creations, persists IDs, and skips drafted records on rerun', async t => {
  const {options, calls, statePath} = fixture(t);
  assert.equal(await draftsFromPreviews(options), 1);
  assert.equal(JSON.parse(fs.readFileSync(statePath)).first.draftId, 'draft-1');
  assert.match(Buffer.from(calls[0].requestBody.message.raw, 'base64url').toString(), /To: hello@example.org/);
  assert.equal(await draftsFromPreviews(options), 1);
  assert.equal(await draftsFromPreviews(options), 0);
  assert.equal(calls.length, 2);
});

test('dry run leaves state unchanged and does not initialize Gmail', async t => {
  const {options, calls, statePath} = fixture(t);
  const before = fs.readFileSync(statePath, 'utf8');
  options.args.push('--dry-run');
  options.gmailFactory = () => assert.fail('Gmail initialized during dry run');
  assert.equal(await draftsFromPreviews(options), 1);
  assert.equal(fs.readFileSync(statePath, 'utf8'), before);
  assert.equal(calls.length, 0);
});

test('uncertain API outcomes are never retried automatically', async t => {
  const {options, statePath} = fixture(t);
  options.draft = async () => {throw Error('sensitive API error');};
  await assert.rejects(draftsFromPreviews(options), /interrupted/);
  const state = JSON.parse(fs.readFileSync(statePath));
  assert.equal(state.first.status, 'drafting');
  state.second.status = 'failed';
  fs.writeFileSync(statePath, JSON.stringify(state));
  assert.equal(await draftsFromPreviews(options), 0);
});

test('rejects invalid limits and overlapping runs', async t => {
  const {options, statePath} = fixture(t);
  await assert.rejects(draftsFromPreviews({...options, args: ['--limit=0']}));
  fs.writeFileSync(`${statePath}.drafts.lock`, '');
  await assert.rejects(draftsFromPreviews(options), /EEXIST/);
});
