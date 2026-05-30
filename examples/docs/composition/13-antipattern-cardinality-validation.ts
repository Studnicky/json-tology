import {
  Compose, JsonTology
} from '../../../src/index.js';

// ✗ Don't do this — owl:cardinality is a TBox semantic axiom for reasoners,
// NOT a runtime validation constraint on instance data
const _StrictBook = Compose.subClassOf(
  Compose.cardinality('https://bookstore.example/authors', 1),
  {
    '$id': 'https://bookstore.example/StrictBook',
    'type': 'object'
  } as const
);
// doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [_StrictBook] as const
});

const restrictionResult = jt.validate('https://bookstore.example/StrictBook', {
  'authors': [
    'A',
    'B'
  ]
});

// Does NOT fail — restrictions are TBox-only, not checked at validate/instantiate time
console.log('owl:cardinality does NOT enforce at validate time:', restrictionResult.ok, '(passes even with 2 authors)');

// ✓ Do this — use JSON Schema keywords for instance validation
const StrictBook2Schema = {
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

console.log('maxItems/minItems enforce at validate time:', StrictBook2Schema.$id);
