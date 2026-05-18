import { Compose } from '../../../src/index.js';

const IN_STOCK = 'https://bookstore.example/inStock';

// TypeScript narrows the inStock property type to the literal `true`
const _InPrintBook = Compose.subClassOf(
  Compose.hasValue(IN_STOCK, true),
  {
    '$id': 'https://bookstore.example/InPrintBook',
    'type': 'object'
  } as const
);

void 0 as unknown as typeof _InPrintBook;
