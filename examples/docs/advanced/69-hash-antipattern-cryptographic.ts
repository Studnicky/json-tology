/**
 * Hash anti-pattern — using Hash.value for security-sensitive purposes.
 *
 * `Hash.value` uses FNV-1a, a non-cryptographic hash. It is not suitable for
 * tokens, signatures, or deduplication of untrusted input. For security use
 * cases, use `node:crypto`.
 *
 * Demonstrates: Hash.value is deterministic but not collision-resistant;
 * node:crypto is the correct choice for security-sensitive hashing.
 */

import { createHash } from 'node:crypto';

import { Hash } from '../../../src/index.js';

// A payload representative of a bookstore session token (never use Hash for this)
const sessionPayload = {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'exp': 1_735_689_600
};

// Anti-pattern: FNV-1a is NOT cryptographically secure
// Do not use Hash.value for tokens or signatures
const fnvHash = Hash.value(sessionPayload);

console.assert(typeof fnvHash === 'string', 'Hash.value returns a string');
console.assert(fnvHash.length > 0, 'Hash.value is non-empty');

// Correct: use node:crypto for security-sensitive hashing
const safeHash = createHash('sha256')
  .update(JSON.stringify(sessionPayload))
  .digest('hex');

console.assert(typeof safeHash === 'string', 'crypto hash is a string');
console.assert(safeHash.length === 64, 'SHA-256 produces a 64-char hex string');
// The two hashes are different algorithms — they must differ in length
console.assert(
  fnvHash.length !== safeHash.length,
  'FNV-1a and SHA-256 hashes are different lengths'
);
