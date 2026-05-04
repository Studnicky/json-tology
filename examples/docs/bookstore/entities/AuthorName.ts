import { Compose } from '../../../../src/index.js';
import { PersonNameSchema } from './PersonName.js';

export const AuthorNameSchema = Compose.equivalent(
  PersonNameSchema,
  {
    '$id': 'urn:bookstore:AuthorName',
    'description': 'A person’s name in the book-authorship context. Validation is owned by PersonName; this is a domain-specific brand.'
  }
);
