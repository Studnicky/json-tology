// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.882Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
//
// WARNING: IRI name collisions detected. Suffixed names used:
//   Distribution (_2, _3, ...)
// ============================================================

import { JsonTology } from 'json-tology';

import { ResourceSchema } from './entities/Resource.js';
import { DistributionSchema } from './entities/Distribution.js';
import { TitleSchema } from './entities/Title.js';
import { DescriptionSchema } from './entities/Description.js';
import { Distribution_2Schema } from './entities/Distribution_2.js';
import { AccessURLSchema } from './entities/AccessURL.js';
import { CatalogSchema } from './entities/Catalog.js';
import { DatasetSchema } from './entities/Dataset.js';

export const dcatSchemas = [
  ResourceSchema,
  DistributionSchema,
  TitleSchema,
  DescriptionSchema,
  Distribution_2Schema,
  AccessURLSchema,
  CatalogSchema,
  DatasetSchema,
] as const;

export const dcat = JsonTology.create({
  "baseIRI": "http://purl.org/dc/terms",
  "schemas": dcatSchemas,
} as const);

// Type re-exports — consumers import named types from this index
export type { Resource } from './entities/Resource.js';
export type { Distribution } from './entities/Distribution.js';
export type { Title } from './entities/Title.js';
export type { Description } from './entities/Description.js';
export type { Distribution_2 } from './entities/Distribution_2.js';
export type { AccessURL } from './entities/AccessURL.js';
export type { Catalog } from './entities/Catalog.js';
export type { Dataset } from './entities/Dataset.js';

// Schema constant re-exports
export { ResourceSchema } from './entities/Resource.js';
export { DistributionSchema } from './entities/Distribution.js';
export { TitleSchema } from './entities/Title.js';
export { DescriptionSchema } from './entities/Description.js';
export { Distribution_2Schema } from './entities/Distribution_2.js';
export { AccessURLSchema } from './entities/AccessURL.js';
export { CatalogSchema } from './entities/Catalog.js';
export { DatasetSchema } from './entities/Dataset.js';

// ============================================================
// END AUTO-GENERATED
// ============================================================
