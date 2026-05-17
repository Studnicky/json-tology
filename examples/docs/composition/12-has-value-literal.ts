import { Compose } from '../../../src/index.js';

const IN_STOCK = 'https://bookstore.example/inStock';

const InPrintBook = Compose.subClassOf(
  Compose.hasValue(IN_STOCK, true),
  {
    '$id': 'https://bookstore.example/InPrintBook',
    'type': 'object'
  } as const
);

// TypeScript narrows the inStock property type to the literal `true`
void 0 as unknown as typeof InPrintBook;
