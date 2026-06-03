import { Compose } from '../../../src/index.js';

// ✗ Don't do this — equivalent expresses class identity, not property constraints
const _InPrintBook = Compose.equivalent(
  {
    '$id': 'https://bookstore.example/Book',
    'type': 'object'
  } as const,
  {
    '$id': 'https://bookstore.example/InPrintBook'
    // can't express owl:hasValue here — equivalent only supports $id / description / title
  }
);

// ✓ Do this — use Compose.subClassOf + Compose.hasValue
const _InPrintBook2 = Compose.subClassOf(
  Compose.hasValue('https://bookstore.example/inStock', true),
  {
    '$id': 'https://bookstore.example/InPrintBook2',
    'type': 'object'
  } as const
);

console.log('equivalent anti-pattern $id:', _InPrintBook.$id, '| preferred subClassOf+hasValue $id:', _InPrintBook2.$id);

