import { Compose } from '../../../src/index.js';

const IN_STOCK = 'https://bookstore.example/inStock';

// TypeScript narrows the inStock property type to the literal `true`
const InPrintBookSchema = Compose.subClassOf(
  Compose.hasValue(IN_STOCK, true),
  {
    '$id': 'https://bookstore.example/InPrintBook',
    'type': 'object'
  } as const
);

console.log('InPrintBook schema $id:', InPrintBookSchema.$id);
console.log('hasValue restriction on inStock:', (InPrintBookSchema as Record<string, unknown>)['jt:restrictions']);
