// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.520Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
// IRI:       http://www.w3.org/ns/dcat#Catalog
// ============================================================

import type { InferType } from 'json-tology/types';

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

export type Catalog = InferType<typeof CatalogSchema>;
