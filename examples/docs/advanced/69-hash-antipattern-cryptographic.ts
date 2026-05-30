/**
 * Hash anti-pattern — using Hash.value for security-sensitive purposes.
 *
 * `Hash.value` uses FNV-1a, a non-cryptographic hash. It is not suitable for
 * tokens, signatures, or deduplication of untrusted input. For security use
 * cases, reach for a cryptographic hash (Web Crypto API in browsers,
 * `node:crypto` in Node) — not `Hash.value`.
 *
 * This example demonstrates Hash.value's characteristics (deterministic,
 * key-order-stable, fast) and explains why these properties are insufficient
 * for security contexts. No node:crypto import is needed to make that point.
 *
 * Demonstrates: Hash.value is deterministic and key-order-stable but not
 * collision-resistant; the antipattern is reaching for it in security contexts.
 */

import { Hash } from '../../../src/index.js';

// A payload representative of a bookstore session token (never use Hash for this)
const sessionPayload = {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'exp': 1_735_689_600
};

// Anti-pattern: FNV-1a is NOT cryptographically secure.
// Do not use Hash.value for tokens, signatures, or security-sensitive dedup.
const fnvHash = Hash.value(sessionPayload);

console.assert(typeof fnvHash === 'string', 'Hash.value returns a string');
console.assert(fnvHash.length > 0, 'Hash.value is non-empty');
console.log('Hash.value (FNV-1a, NOT for security):', fnvHash);

// Hash.value is deterministic: same input always produces same output.
const repeated = Hash.value(sessionPayload);

console.assert(fnvHash === repeated, 'Hash.value is deterministic');
console.log('Deterministic (same input -> same hash):', fnvHash === repeated);

// Hash.value is key-order-stable: object key order does not affect the result.
// Both orderings of the same keys produce the identical hash.
const payloadAlt = Object.fromEntries(Object.entries(sessionPayload).reverse()) as typeof sessionPayload;
const reordered = Hash.value(payloadAlt);

console.assert(fnvHash === reordered, 'Hash.value is key-order-stable');
console.log('Key-order-stable (reordered keys -> same hash):', fnvHash === reordered);

// The antipattern: FNV-1a produces short hashes vulnerable to collision attacks.
// A 32-bit FNV-1a hash has 2^32 possible values — trivially brute-forced.
// For security: use Web Crypto (browser) or node:crypto (Node).
//
//   // Browser / Node 18+
//   const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
//   const safeHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
//
// SHA-256 produces 256-bit output — 2^256 possible values, not feasibly bruted.
// Use Hash.value for cache keys and schema fingerprints; use Web Crypto for tokens.

console.log('FNV-1a hash length (bits, approx):', fnvHash.length * 4);
console.log('SHA-256 hex length would be: 64 (256 bits) — far stronger for security');
