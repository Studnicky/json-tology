/**
 * 06-composition — Schema composition
 *
 * Demonstrates: extending, picking, and making schemas partial using
 * the Compose utility. Each derived schema is a valid JSON Schema
 * that can be registered and validated against.
 *
 * Run: npm run build && npx tsx examples/06-composition.ts
 */

import {
  Compose, JsonTology
} from '../src/index.js';

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
} as const;

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

// Compose.extend composes via `allOf: [{ $ref: parent }, additions]` at runtime,
// so the merged property view lives in the inferred TS type rather than as a flat
// `properties` object on the value. Validation below proves the merge is in effect.
console.log('--- Compose.extend (AdminUser) ---');
console.log('$id:', AdminUserSchema.$id);
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
const summaryRequired = [...EntitySummarySchema.required];

console.log('Required:', summaryRequired.length > 0 ? summaryRequired.join(', ') : '(none)');
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
// Compose.partial drops the `required` array entirely — every field is optional.
console.log('Required:', '(none — all optional)');
console.log();

// ---------------------------------------------------------------------------
// 4. Validate against each derived schema
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (format, enum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'enableStrictGraph': false,
  'schemas': [EntitySchema]
});

const jt2 = jt
  .set(AdminUserSchema)
  .set(EntitySummarySchema)
  .set(PatchEntitySchema);

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

const entityErrors = jt2.validate(EntitySchema.$id, fullEntity);

console.log('Entity (valid):', entityErrors.length === 0 ? 'PASS' : entityErrors);

const adminErrors = jt2.validate(AdminUserSchema.$id, adminUser);

console.log('AdminUser (valid):', adminErrors.length === 0 ? 'PASS' : adminErrors);

const summaryErrors = jt2.validate(EntitySummarySchema.$id, {
  'id': '1',
  'name': 'Alice'
});

console.log('EntitySummary (valid):', summaryErrors.length === 0 ? 'PASS' : summaryErrors);

const patchErrors = jt2.validate(PatchEntitySchema.$id, { 'name': 'Bob' });

console.log('PatchEntity (partial):', patchErrors.length === 0 ? 'PASS' : patchErrors);

const badAdmin = {
  'id': '2',
  'name': 'Eve'
};
const badAdminErrors = jt2.validate(AdminUserSchema.$id, badAdmin);

console.log('AdminUser (missing email):', badAdminErrors.length > 0 ? 'FAIL as expected' : 'unexpected pass');
