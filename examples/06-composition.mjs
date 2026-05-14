/**
 * 06-composition.mjs — Schema composition
 *
 * Demonstrates: extending, picking, and making schemas partial using
 * the Compose utility. Each derived schema is a valid JSON Schema
 * that can be registered and validated against.
 *
 * Run: npm run build && node examples/06-composition.mjs
 */

import {
  Compose, JsonTology
} from '../dist/index.js';

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const EntitySchema = {
  '$id': 'https://example.com/Entity',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'name',
    'email'
  ],
  'type': 'object'
};

// ---------------------------------------------------------------------------
// 1. Extend — add fields to create AdminUser
// ---------------------------------------------------------------------------

const AdminUserSchema = Compose.extend(
  EntitySchema,
  {
    'permissions': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'role': {
      'enum': [
        'admin',
        'superadmin'
      ],
      'type': 'string'
    }
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
  [
    'id',
    'name'
  ],
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
  'baseIRI': 'https://example.com',
  'schemas': [EntitySchema]
});

jt.set(AdminUserSchema);
jt.set(EntitySummarySchema);
jt.set(PatchEntitySchema);

const fullEntity = {
  'createdAt': '2026-01-01T00:00:00Z',
  'email': 'alice@example.com',
  'id': '1',
  'name': 'Alice'
};

const adminUser = {
  ...fullEntity,
  'permissions': [
    'read',
    'write',
    'delete'
  ],
  'role': 'admin'
};

console.log('--- Validation results ---');

const entityErrors = jt.validate(EntitySchema.$id, fullEntity);

console.log('Entity (valid):', entityErrors.length === 0 ? 'PASS' : entityErrors);

const adminErrors = jt.validate(AdminUserSchema.$id, adminUser);

console.log('AdminUser (valid):', adminErrors.length === 0 ? 'PASS' : adminErrors);

const summaryErrors = jt.validate(EntitySummarySchema.$id, {
  'id': '1',
  'name': 'Alice'
});

console.log('EntitySummary (valid):', summaryErrors.length === 0 ? 'PASS' : summaryErrors);

const patchErrors = jt.validate(PatchEntitySchema.$id, { 'name': 'Bob' });

console.log('PatchEntity (partial):', patchErrors.length === 0 ? 'PASS' : patchErrors);

const badAdmin = {
  'id': '2',
  'name': 'Eve'
};
const badAdminErrors = jt.validate(AdminUserSchema.$id, badAdmin);

console.log('AdminUser (missing email):', badAdminErrors.length > 0 ? 'FAIL as expected' : 'unexpected pass');
