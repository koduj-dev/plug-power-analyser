import crypto from 'node:crypto';
import { ShellyAuthError, ShellyHttpError, ShellyNetworkError } from './errors.js';

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop: string | null;
  opaque: string | null;
  algorithm: 'MD5' | 'SHA-256';
}

export interface DigestCredentials {
  username: string;
  password: string;
}

function hash(algorithm: 'MD5' | 'SHA-256', value: string): string {
  const nodeAlgo = algorithm === 'SHA-256' ? 'sha256' : 'md5';
  return crypto.createHash(nodeAlgo).update(value).digest('hex');
}

/** Parses a WWW-Authenticate: Digest ... header into its component directives. */
export function parseDigestChallenge(headerValue: string): DigestChallenge {
  if (!headerValue.trim().toLowerCase().startsWith('digest')) {
    throw new ShellyAuthError('Unsupported WWW-Authenticate scheme');
  }
  const directives: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(headerValue)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3];
    if (key !== undefined && value !== undefined) directives[key] = value;
  }
  const realm = directives.realm;
  const nonce = directives.nonce;
  if (!realm || !nonce) {
    throw new ShellyAuthError('Malformed WWW-Authenticate header');
  }
  const rawAlgorithm = (directives.algorithm ?? 'MD5').toUpperCase();
  const algorithm: 'MD5' | 'SHA-256' = rawAlgorithm === 'SHA-256' ? 'SHA-256' : 'MD5';
  return {
    realm,
    nonce,
    qop: directives.qop ?? null,
    opaque: directives.opaque ?? null,
    algorithm,
  };
}

function buildAuthorizationHeader(
  challenge: DigestChallenge,
  credentials: DigestCredentials,
  method: string,
  uri: string,
): string {
  const ha1 = hash(challenge.algorithm, `${credentials.username}:${challenge.realm}:${credentials.password}`);
  const ha2 = hash(challenge.algorithm, `${method}:${uri}`);
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  let response: string;
  const qop = challenge.qop?.split(',').map((s) => s.trim()).includes('auth') ? 'auth' : null;
  if (qop) {
    response = hash(challenge.algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = hash(challenge.algorithm, `${ha1}:${challenge.nonce}:${ha2}`);
  }

  const parts = [
    `username="${credentials.username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    `algorithm=${challenge.algorithm}`,
  ];
  if (qop) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  if (challenge.opaque) {
    parts.push(`opaque="${challenge.opaque}"`);
  }
  return `Digest ${parts.join(', ')}`;
}

export interface FetchJsonOptions {
  timeoutMs: number;
  credentials?: DigestCredentials | null;
}

/**
 * GETs a URL, transparently handling HTTP Digest Authentication (RFC 2617,
 * MD5 or SHA-256 as used by Shelly Gen2+ firmware) if the server challenges
 * an initial unauthenticated request.
 */
export async function fetchJsonWithDigestAuth(url: string, options: FetchJsonOptions): Promise<unknown> {
  const parsed = new URL(url);
  const uri = parsed.pathname + parsed.search;
  const signal = AbortSignal.timeout(options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    throw new ShellyNetworkError(`Request to ${parsed.host} failed: ${(err as Error).message}`, err);
  }

  if (response.ok) {
    return response.json();
  }

  if (response.status !== 401) {
    throw new ShellyHttpError(`Unexpected HTTP status ${response.status} from ${parsed.host}`, response.status);
  }

  if (!options.credentials) {
    throw new ShellyAuthError('Device requires authentication but no credentials are configured');
  }

  const challengeHeader = response.headers.get('www-authenticate');
  if (!challengeHeader) {
    throw new ShellyAuthError('Device returned 401 without a WWW-Authenticate header');
  }
  const challenge = parseDigestChallenge(challengeHeader);
  const authHeader = buildAuthorizationHeader(challenge, options.credentials, 'GET', uri);

  let authedResponse: Response;
  try {
    authedResponse = await fetch(url, {
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: { Authorization: authHeader },
    });
  } catch (err) {
    throw new ShellyNetworkError(`Authenticated request to ${parsed.host} failed: ${(err as Error).message}`, err);
  }

  if (authedResponse.status === 401) {
    throw new ShellyAuthError('Authentication rejected by device (invalid username/password)');
  }
  if (!authedResponse.ok) {
    throw new ShellyHttpError(
      `Unexpected HTTP status ${authedResponse.status} from ${parsed.host}`,
      authedResponse.status,
    );
  }
  return authedResponse.json();
}
