/**
 * JsonLdDatasetQuadType — shape of a single quad as emitted by `jsonld.toRDF()`.
 *
 * @remarks
 * Each property holds a `DatasetTermType` with a `termType` discriminator and a
 * `value` string. The `object` additionally carries an optional `datatype`
 * and `language` for RDF literals. This interface is used exclusively by
 * {@link QuadFactory.fromDatasetQuad} to convert jsonld dataset quads into
 * the project-canonical `QuadInterface` representation.
 *
 * @example
 * ```ts
 * const quad = QuadFactory.fromDatasetQuad(datasetQuad);
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link QuadFactory}
 * @group QuadFactory
 */

import type { InferType } from './Schema.js';

const DatasetTermSchema = {
  'properties': {
    'termType': { 'type': 'string' },
    'value': { 'type': 'string' }
  },
  'required': [
    'termType',
    'value'
  ],
  'type': 'object'
} as const;

export type DatasetTermType = InferType<typeof DatasetTermSchema>;

export type DatasetLiteralTermType = DatasetTermType & {
  'datatype'?: DatasetTermType;
  'language'?: string;
};

const _JsonLdDatasetQuadSchema = {
  '$defs': { 'DatasetTerm': DatasetTermSchema },
  'properties': {
    'graph': { '$ref': '#/$defs/DatasetTerm' },
    'object': { '$ref': '#/$defs/DatasetTerm' },
    'predicate': { '$ref': '#/$defs/DatasetTerm' },
    'subject': { '$ref': '#/$defs/DatasetTerm' }
  },
  'required': [
    'graph',
    'object',
    'predicate',
    'subject'
  ],
  'type': 'object'
} as const;

type JsonLdDatasetQuadSchemaType = InferType<typeof _JsonLdDatasetQuadSchema>;

export type JsonLdDatasetQuadType = {
  'object': DatasetLiteralTermType;
} & {
  [K in keyof JsonLdDatasetQuadSchemaType as K extends 'object' ? never : K]: JsonLdDatasetQuadSchemaType[K];
};
