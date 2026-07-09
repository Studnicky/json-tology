/**
 * Canonical decode/default ordering — passthrough decode.
 *
 * `instantiate` runs `decode` BEFORE validation, not after:
 * `decode → validate (fills defaults, strips unknown) → invariants`.
 *
 * A passthrough `decode` — one that returns its input unchanged — proves
 * the ordering directly: the decoder itself does no default-filling, yet
 * the value `instantiate` finally returns has every default filled in,
 * because the validation pass that runs after `decode` fills them.
 */

import {
  JsonTology, Transform
} from '../../../src/index.js';

const ConfigSchema = {
  '$id': 'urn:example:PassthroughConfig',
  'properties': {
    'model': { 'type': 'string' },
    'port': {
      'default': 11_434,
      'type': 'integer'
    }
  },
  'required': ['model'],
  'type': 'object'
} as const;

// Passthrough decode: returns the raw wire value unchanged. It does not
// fill `port` itself — instantiate's validation pass does that after decode
// runs.
const ConfigCodec = Transform.create(ConfigSchema, {
  'decode': (raw: { 'model': string;
    'port'?: number; }) => {
    return raw;
  },
  'encode': (value: { 'model': string;
    'port'?: number; }) => {
    return value;
  }
});

const jt = JsonTology.create({
  'baseIri': 'urn:example',
  'schemas': [ConfigCodec]
});

const out = jt.instantiate(ConfigCodec.$id, { 'model': 'ollama:llama3' });

console.assert(out.model === 'ollama:llama3');
console.assert(out.port === 11_434, 'default filled in after the passthrough decode ran');

console.log('decode returned:', { 'model': 'ollama:llama3' });
console.log('instantiate returned (defaults filled after decode):', out);
