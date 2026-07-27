import {
  Compose, JsonTology
} from '../../../src/index.js';

// ✗ Don't do this — minCardinality on a multi-valued property is an OWL axiom;
// it does NOT add a minItems constraint on the JSON Schema array
const authoredBook = Compose.subClassOf(
  Compose.minimumCardinality('https://bookstore.example/authors', 2),
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

const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'schemas': [AuthoredBook2Schema] as const
});

const minItemsResult = jt.validate('https://bookstore.example/AuthoredBook2', { 'authors': [] });

console.log('anti-pattern — minCardinality does not add runtime enforcement (authoredBook.$id):', authoredBook.$id);
// Fails — minItems is a JSON Schema keyword checked at validate time
console.log('minCardinality is TBox-only — minItems enforces at validate time:', minItemsResult.ok, '(rejects empty authors)');
