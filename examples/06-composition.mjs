/**
 * 06-composition.mjs — Schema composition
 *
 * Demonstrates: extending, picking, and making schemas partial using
 * the Compose utility. Each derived schema is a valid JSON Schema
 * that can be registered and validated against.
 *
 * Run: npm run build && node examples/06-composition.mjs
 */

import { JsonTology, Compose } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const EntitySchema = {
  $id: 'https://example.com/Entity',
  type: 'object',
  properties: {
    id:        { type: 'string' },
    name:      { type: 'string' },
    email:     { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'email'],
};

// ---------------------------------------------------------------------------
// 1. Extend — add fields to create AdminUser
// ---------------------------------------------------------------------------

const AdminUserSchema = Compose.extend(
  EntitySchema,
  {
    role:        { type: 'string', enum: ['admin', 'superadmin'] },
    permissions: { type: 'array', items: { type: 'string' } },
  },
  'https://example.com/AdminUser'
);

console.log('--- Compose.extend (AdminUser) ---');
console.log('$id:', AdminUserSchema.$id);
console.log('Properties:', Object.keys(AdminUserSchema.properties).join(', '));
console.log('Required:', [...AdminUserSchema.required].join(', '));
console.log();

// ---------------------------------------------------------------------------
// 2. Pick — select a subset of fields
// ---------------------------------------------------------------------------

const EntitySummarySchema = Compose.pick(
  EntitySchema,
  ['id', 'name'],
  'https://example.com/EntitySummary'
);

console.log('--- Compose.pick (EntitySummary) ---');
console.log('$id:', EntitySummarySchema.$id);
console.log('Properties:', Object.keys(EntitySummarySchema.properties).join(', '));
console.log('Required:', EntitySummarySchema.required ? [...EntitySummarySchema.required].join(', ') : '(none)');
console.log();

// ---------------------------------------------------------------------------
// 3. Partial — make all fields optional
// ---------------------------------------------------------------------------

const PatchEntitySchema = Compose.partial(
  EntitySchema,
  'https://example.com/PatchEntity'
);

console.log('--- Compose.partial (PatchEntity) ---');
console.log('$id:', PatchEntitySchema.$id);
console.log('Properties:', Object.keys(PatchEntitySchema.properties).join(', '));
console.log('Required:', PatchEntitySchema.required || '(none — all optional)');
console.log();

// ---------------------------------------------------------------------------
// 4. Validate against each derived schema
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [EntitySchema],
});

jt.register(AdminUserSchema);
jt.register(EntitySummarySchema);
jt.register(PatchEntitySchema);

const fullEntity = {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  createdAt: '2026-01-01T00:00:00Z',
};

const adminUser = {
  ...fullEntity,
  role: 'admin',
  permissions: ['read', 'write', 'delete'],
};

console.log('--- Validation results ---');

const entityErrors = jt.validate(EntitySchema.$id, fullEntity);
console.log('Entity (valid):', entityErrors.length === 0 ? 'PASS' : entityErrors);

const adminErrors = jt.validate(AdminUserSchema.$id, adminUser);
console.log('AdminUser (valid):', adminErrors.length === 0 ? 'PASS' : adminErrors);

const summaryErrors = jt.validate(EntitySummarySchema.$id, { id: '1', name: 'Alice' });
console.log('EntitySummary (valid):', summaryErrors.length === 0 ? 'PASS' : summaryErrors);

const patchErrors = jt.validate(PatchEntitySchema.$id, { name: 'Bob' });
console.log('PatchEntity (partial):', patchErrors.length === 0 ? 'PASS' : patchErrors);

const badAdmin = { id: '2', name: 'Eve' };
const badAdminErrors = jt.validate(AdminUserSchema.$id, badAdmin);
console.log('AdminUser (missing email):', badAdminErrors.length > 0 ? 'FAIL as expected' : 'unexpected pass');
