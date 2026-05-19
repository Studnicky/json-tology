import type { NominalSchemaType } from '../../../src/types/index.js';

const _UserSchema = {
  '$id': 'https://example.com/User',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

const _EmployeeSchema = {
  '$id': 'https://example.com/Employee',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

type User = NominalSchemaType<typeof _UserSchema>;
type Employee = NominalSchemaType<typeof _EmployeeSchema>;

// Structurally identical but nominally distinct  - cannot assign one to the other
void 0 as unknown as [User, Employee];
