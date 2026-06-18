/**
 * Advanced Example 81 — opting out of strict graph mode
 * Demonstrates: strict enforcement is the default; pass enableStrictGraph: false
 * to downgrade inline-shape and duplicate errors to warnings.
 *
 * Both entry points accept the same flag: the JsonTology facade and the
 * SchemaRegistry it wraps.
 */

import { JsonTology } from '../../../src/index.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

const SchemaWithInlineShape = {
  '$id': 'urn:example:Book',
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

// Facade: relax enforcement for the whole instance. With strict mode off, the
// inline primitive shape registers with a warning instead of throwing.
const jt = JsonTology.create({
  'baseIri': 'https://example.com/',
  'enableStrictGraph': false,
  'schemas': [SchemaWithInlineShape]
});

// Registry directly: same flag, same effect.
const registry = new SchemaRegistry({ 'enableStrictGraph': false });

registry.set(SchemaWithInlineShape);

console.log('Permissive mode: inline shapes accepted on both entry points', jt.registry.size, registry.size);
