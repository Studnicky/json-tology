// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.882Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
//
// WARNING: IRI name collisions detected. Suffixed names used:
//   Distribution (_2, _3, ...)
// ============================================================

import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';

export const ResourceSchema = {
  "$id": "http://purl.org/dc/terms/Resource",
  "description": "Anything described by RDF (external Dublin Core class, kept as a stub).",
  "properties": {
    "description": {
      "type": "string",
    },
    "title": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Resource",
  "type": "object",
} as const;

export const DistributionSchema = {
  "$id": "http://www.w3.org/ns/dcat#Distribution",
  "description": "A specific representation of a dataset.",
  "properties": {
    "accessURL": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Distribution",
  "type": "object",
} as const;

export const TitleSchema = {
  "$id": "http://www.w3.org/ns/dcat#title",
  "description": "A name given to the resource.",
  "title": "title",
} as const;

export const DescriptionSchema = {
  "$id": "http://www.w3.org/ns/dcat#description",
  "description": "A free-text account of the resource.",
  "title": "description",
} as const;

export const Distribution_2Schema = {
  "$id": "http://www.w3.org/ns/dcat#distribution",
  "description": "An available distribution of the dataset.",
  "title": "distribution",
} as const;

export const AccessURLSchema = {
  "$id": "http://www.w3.org/ns/dcat#accessURL",
  "description": "A URL of the resource that gives access to a distribution. Range is xsd:string in this subset (xsd:anyURI would produce a { format: uri } inline constraint that requires enableStrictGraph: false).",
  "title": "access URL",
} as const;

export const CatalogSchema = {
  "$id": "http://www.w3.org/ns/dcat#Catalog",
  "allOf": [
    {
      "$ref": "http://purl.org/dc/terms/Resource",
    },
  ],
  "description": "A curated collection of metadata about resources.",
  "properties": {},
  "required": [],
  "title": "Catalog",
  "type": "object",
} as const;

export const DatasetSchema = {
  "$id": "http://www.w3.org/ns/dcat#Dataset",
  "allOf": [
    {
      "$ref": "http://purl.org/dc/terms/Resource",
    },
  ],
  "description": "A collection of data, published or curated by a single agent.",
  "properties": {
    "distribution": {
      "$ref": "http://www.w3.org/ns/dcat#Distribution",
    },
  },
  "required": [],
  "title": "Dataset",
  "type": "object",
} as const;

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

export type Resource = InferType<typeof ResourceSchema>;
export type Distribution = InferType<typeof DistributionSchema>;
export type Title = InferType<typeof TitleSchema>;
export type Description = InferType<typeof DescriptionSchema>;
export type Distribution_2 = InferType<typeof Distribution_2Schema>;
export type AccessURL = InferType<typeof AccessURLSchema>;
export type Catalog = InferType<typeof CatalogSchema>;
export type Dataset = InferType<typeof DatasetSchema>;

// ============================================================
// END AUTO-GENERATED
// ============================================================
