import { Compose } from '../../../../src/index.js';
import { CustomerNameSchema } from './CustomerName.js';

export const AuthorNameSchema = Compose.equivalent(
  CustomerNameSchema,
  {
    '$id': 'urn:bookstore:AuthorName',
    'description': 'Same validation as CustomerName; semantically a distinct domain concept (book authorship, not customer identity).'
  }
);
