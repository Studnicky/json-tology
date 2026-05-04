import { Compose } from '../../../../src/index.js';
import { PersonNameSchema } from './PersonName.js';

export const CustomerNameSchema = Compose.equivalent(
  PersonNameSchema,
  {
    '$id': 'urn:bookstore:CustomerName',
    'description': 'A person’s name in the customer-identity context. Validation is owned by PersonName; this is a domain-specific brand.'
  }
);
