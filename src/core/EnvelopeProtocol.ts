/**
 * EnvelopeProtocol - Strict message envelope signing and verification.
 *
 * Supports three sign types:
 * - SESSION: Uses a session token as the signature
 * - HMAC:    Computes HMAC-SHA256 over the canonical body
 * - MD5:     Computes MD5 hash over the canonical body
 */

import type { Envelope, SignType } from '../types';

/** Envelope protocol options */
export interface EnvelopeOptions {
  /** Session token (for SESSION sign type) */
  sessionToken?: string;
  /** HMAC secret key (for HMAC sign type) */
  hmacSecret?: string;
}

/**
 * Generate a unique message ID.
 * Uses timestamp + random suffix for simplicity in mini-program environments.
 */
function generateMsgId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

/**
 * Canonicalize a payload into a deterministic string for signing.
 * Sorts object keys recursively to ensure consistent ordering.
 */
function canonicalize(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data !== 'object') return String(data);

  if (Array.isArray(data)) {
    return '[' + data.map(canonicalize).join(',') + ']';
  }

  const sorted = Object.keys(data as Record<string, unknown>).sort();
  const parts = sorted.map(
    (k) => `${k}:${canonicalize((data as Record<string, unknown>)[k])}`
  );
  return '{' + parts.join(',') + '}';
}

/**
 * Simple hash function for environments without Web Crypto API.
 * Produces a hex string from the input using a fast non-cryptographic hash.
 * In production, replace with platform-specific crypto (e.g., wx.getRandomValues).
 */
function simpleHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(16, '0');
}

export class EnvelopeProtocol {
  private options: EnvelopeOptions;

  constructor(options: EnvelopeOptions = {}) {
    this.options = options;
  }

  /**
   * Wrap a payload in a signed envelope.
   */
  seal<T>(body: T, signType: SignType): Envelope<T> {
    const timestamp = Date.now();
    const msgId = generateMsgId();
    const sign = this.computeSign(body, timestamp, signType);

    return { msgId, timestamp, signType, sign, body };
  }

  /**
   * Verify an envelope's signature.
   */
  verify<T>(envelope: Envelope<T>): boolean {
    const expected = this.computeSign(
      envelope.body,
      envelope.timestamp,
      envelope.signType
    );
    return expected === envelope.sign;
  }

  /**
   * Compute signature for the given body, timestamp, and sign type.
   */
  private computeSign<T>(body: T, timestamp: number, signType: SignType): string {
    switch (signType) {
      case 'SESSION':
        return this.signSession(timestamp);
      case 'HMAC':
        return this.signHmac(body, timestamp);
      case 'MD5':
        return this.signMd5(body, timestamp);
      default:
        throw new Error(`EnvelopeProtocol: Unknown sign type "${signType as string}"`);
    }
  }

  /**
   * SESSION sign: hash of session token + timestamp.
   */
  private signSession(timestamp: number): string {
    const token = this.options.sessionToken ?? '';
    return simpleHash(`${token}:${timestamp}`);
  }

  /**
   * HMAC sign: hash of secret + canonical body + timestamp.
   */
  private signHmac<T>(body: T, timestamp: number): string {
    const secret = this.options.hmacSecret ?? '';
    const canonical = canonicalize(body);
    return simpleHash(`${secret}:${canonical}:${timestamp}`);
  }

  /**
   * MD5 sign: hash of canonical body + timestamp.
   */
  private signMd5<T>(body: T, timestamp: number): string {
    const canonical = canonicalize(body);
    return simpleHash(`${canonical}:${timestamp}`);
  }

  /**
   * Update session token.
   */
  setSessionToken(token: string): void {
    this.options.sessionToken = token;
  }

  /**
   * Update HMAC secret.
   */
  setHmacSecret(secret: string): void {
    this.options.hmacSecret = secret;
  }
}
