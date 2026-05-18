import { Compose } from '../../../src/index.js';

const AUTHORED_BY = 'https://bookstore.example/authoredBy';
const AUTHOR_IRI = 'https://bookstore.example/Author';

// TypeScript narrows the authored-by property to a non-empty tuple at compile time
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AuthoredBookSchema = Compose.subClassOf(
  Compose.someValuesFrom(AUTHORED_BY, AUTHOR_IRI),
  {
    '$id': 'https://bookstore.example/AuthoredBook',
    'type': 'object'
  } as const
);

void 0 as unknown as typeof AuthoredBookSchema;
