// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.520Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
// IRI:       http://www.w3.org/ns/dcat#Dataset
// ============================================================

import type { InferType } from 'json-tology/types';

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

export type Dataset = InferType<typeof DatasetSchema>;
