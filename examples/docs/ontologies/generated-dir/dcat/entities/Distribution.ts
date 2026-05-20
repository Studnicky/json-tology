// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.520Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
// IRI:       http://www.w3.org/ns/dcat#Distribution
// ============================================================

import type { InferType } from 'json-tology/types';

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

export type Distribution = InferType<typeof DistributionSchema>;
