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
// The $id brands make User and Employee incompatible at compile time.
type UserIsNotEmployee = User extends Employee ? false : true;
type EmployeeIsNotUser = Employee extends User ? false : true;
const brandCheck: [UserIsNotEmployee, EmployeeIsNotUser] = [
  true,
  true
];

console.log('User $id:', _UserSchema.$id);
console.log('Employee $id:', _EmployeeSchema.$id);
console.log('Nominal incompatibility (User !extends Employee, Employee !extends User):', brandCheck);
