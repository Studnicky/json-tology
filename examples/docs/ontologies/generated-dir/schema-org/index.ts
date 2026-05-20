// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.522Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// ============================================================

import { JsonTology } from 'json-tology';

import { ThingSchema } from './entities/Thing.js';
import { IsbnTypeSchema } from './entities/IsbnType.js';
import { NameSchema } from './entities/Name.js';
import { IsbnSchema } from './entities/Isbn.js';
import { AuthorSchema } from './entities/Author.js';
import { PublisherSchema } from './entities/Publisher.js';
import { PersonSchema } from './entities/Person.js';
import { OrganizationSchema } from './entities/Organization.js';
import { BookSchema } from './entities/Book.js';

export const schemaOrgSchemas = [
  ThingSchema,
  IsbnTypeSchema,
  NameSchema,
  IsbnSchema,
  AuthorSchema,
  PublisherSchema,
  PersonSchema,
  OrganizationSchema,
  BookSchema,
] as const;

export const schemaOrg = JsonTology.create({
  "baseIRI": "https://schema.org",
  "schemas": schemaOrgSchemas,
} as const);

// Type re-exports — consumers import named types from this index
export type { Thing } from './entities/Thing.js';
export type { IsbnType } from './entities/IsbnType.js';
export type { Name } from './entities/Name.js';
export type { Isbn } from './entities/Isbn.js';
export type { Author } from './entities/Author.js';
export type { Publisher } from './entities/Publisher.js';
export type { Person } from './entities/Person.js';
export type { Organization } from './entities/Organization.js';
export type { Book } from './entities/Book.js';

// Schema constant re-exports
export { ThingSchema } from './entities/Thing.js';
export { IsbnTypeSchema } from './entities/IsbnType.js';
export { NameSchema } from './entities/Name.js';
export { IsbnSchema } from './entities/Isbn.js';
export { AuthorSchema } from './entities/Author.js';
export { PublisherSchema } from './entities/Publisher.js';
export { PersonSchema } from './entities/Person.js';
export { OrganizationSchema } from './entities/Organization.js';
export { BookSchema } from './entities/Book.js';

// ============================================================
// END AUTO-GENERATED
// ============================================================
