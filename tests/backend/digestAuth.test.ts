import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseDigestChallenge, fetchJsonWithDigestAuth } from '../../backend/src/shelly/digestAuth.js';
import { ShellyAuthError } from '../../backend/src/shelly/errors.js';

test('parseDigestChallenge parses realm/nonce/qop/opaque/algorithm', () => {
  const header = 'Digest realm="shellyplug", nonce="abc123", qop="auth", opaque="xyz", algorithm=SHA-256';
  const challenge = parseDigestChallenge(header);
  assert.equal(challenge.realm, 'shellyplug');
  assert.equal(challenge.nonce, 'abc123');
  assert.equal(challenge.qop, 'auth');
  assert.equal(challenge.opaque, 'xyz');
  assert.equal(challenge.algorithm, 'SHA-256');
});

test('parseDigestChallenge defaults algorithm to MD5 when absent', () => {
  const header = 'Digest realm="r", nonce="n"';
  const challenge = parseDigestChallenge(header);
  assert.equal(challenge.algorithm, 'MD5');
});

test('parseDigestChallenge rejects non-Digest schemes', () => {
  assert.throws(() => parseDigestChallenge('Basic realm="r"'), ShellyAuthError);
});

function computeExpectedResponse(
  algo: 'md5' | 'sha256',
  username: string,
  realm: string,
  password: string,
  method: string,
  uri: string,
  nonce: string,
) {
  const ha1 = crypto.createHash(algo).update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash(algo).update(`${method}:${uri}`).digest('hex');
  return crypto.createHash(algo).update(`${ha1}:${nonce}:${ha2}`).digest('hex');
}

test('fetchJsonWithDigestAuth performs MD5 digest round-trip against a fake server', async (t) => {
  const realm = 'shellyplug-abc';
  const nonce = 'testnonce123';
  const username = 'admin';
  const password = 'secret';
  let sawAuthHeader: string | null = null;

  const originalFetch = globalThis.fetch;
  let callCount = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      return new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': `Digest realm="${realm}", nonce="${nonce}", algorithm=MD5` },
      });
    }
    sawAuthHeader = (init?.headers as Record<string, string>)?.Authorization ?? null;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const result = await fetchJsonWithDigestAuth('http://192.168.0.1/rpc/Switch.GetStatus?id=0', {
    timeoutMs: 1000,
    credentials: { username, password },
  });

  assert.deepEqual(result, { ok: true });
  assert.ok(sawAuthHeader?.includes('Digest'));

  const expected = computeExpectedResponse(
    'md5',
    username,
    realm,
    password,
    'GET',
    '/rpc/Switch.GetStatus?id=0',
    nonce,
  );
  assert.ok(sawAuthHeader?.includes(`response="${expected}"`));
});

test('fetchJsonWithDigestAuth throws ShellyAuthError when second attempt also 401s', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Digest realm="r", nonce="n", algorithm=MD5' },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      fetchJsonWithDigestAuth('http://192.168.0.1/rpc/Switch.GetStatus?id=0', {
        timeoutMs: 1000,
        credentials: { username: 'a', password: 'b' },
      }),
    ShellyAuthError,
  );
});

test('fetchJsonWithDigestAuth throws ShellyAuthError when 401 without credentials configured', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Digest realm="r", nonce="n"' },
    })) as typeof fetch;

  await assert.rejects(
    () => fetchJsonWithDigestAuth('http://192.168.0.1/rpc/Switch.GetStatus?id=0', { timeoutMs: 1000 }),
    ShellyAuthError,
  );
});
