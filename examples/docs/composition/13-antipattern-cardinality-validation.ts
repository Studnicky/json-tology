import {
  Compose, JsonTology
} from '../../../src/index.js';

// ✗ Don't do this — owl:cardinality is a TBox semantic axiom for reasoners,
// NOT a runtime validation constraint on instance data
const StrictBook = Compose.subClassOf(
  Compose.cardinality('https://bookstore.example/authors', 1),
  {
    '$id': 'https://bookstore.example/StrictBook',
    'type': 'object'
  } as const
);
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [StrictBook] as const
});

jt.validate('https://bookstore.example/StrictBook', {
  'authors': [
    'A',
    'B'
  ]
});
// Does NOT fail — restrictions are TBox-only, not checked at validate/instantiate time

// ✓ Do this — use JSON Schema keywords for instance validation
const StrictBook2 = {
  '$id': 'https://bookstore.example/StrictBook2',
  'properties': {
    'authors': {
      'maxItems': 1,
      'minItems': 1,
      'type': 'array'
    }
  },
  'type': 'object'
} as const;

void 0 as unknown as [typeof jt, typeof StrictBook2];
