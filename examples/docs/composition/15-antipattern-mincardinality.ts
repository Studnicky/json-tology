import { Compose } from '../../../src/index.js';

// ✗ Don't do this — minCardinality on a multi-valued property is an OWL axiom;
// it does NOT add a minItems constraint on the JSON Schema array
const authoredBook = Compose.subClassOf(
  Compose.minCardinality('https://bookstore.example/authors', 2),
  {
    '$id': 'https://bookstore.example/AuthoredBook',
    'type': 'object'
  } as const
);
// jt.validate('AuthoredBook', { authors: [] }) → passes (no minItems in JSON Schema)

// ✓ Do this — use minItems in the JSON Schema definition for runtime enforcement
const AuthoredBook2Schema = {
  '$id': 'https://bookstore.example/AuthoredBook2',
  'properties': {
    'authors': {
      'minItems': 2,
      'type': 'array'
    }
  },
  'type': 'object'
} as const;

console.log('anti-pattern — minCardinality does not add runtime enforcement (authoredBook.$id):', authoredBook.$id);
console.log('minCardinality is TBox-only (OWL axiom) — for runtime use minItems:', AuthoredBook2Schema.$id);
