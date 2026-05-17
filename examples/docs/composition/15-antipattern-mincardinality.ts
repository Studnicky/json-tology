import { Compose } from '../../../src/index.js';

// ✗ Don't do this — minCardinality on a multi-valued property is an OWL axiom;
// it does NOT add a minItems constraint on the JSON Schema array
const AuthoredBook = Compose.subClassOf(
  Compose.minCardinality('https://bookstore.example/authors', 2),
  {
    '$id': 'https://bookstore.example/AuthoredBook',
    'type': 'object'
  } as const
);
// jt.validate('AuthoredBook', { authors: [] }) → passes (no minItems in JSON Schema)

// ✓ Do this — use minItems in the JSON Schema definition for runtime enforcement
const AuthoredBook2 = {
  '$id': 'https://bookstore.example/AuthoredBook2',
  'properties': {
    'authors': {
      'minItems': 2,
      'type': 'array'
    }
  },
  'type': 'object'
} as const;

void 0 as unknown as [typeof AuthoredBook, typeof AuthoredBook2];
