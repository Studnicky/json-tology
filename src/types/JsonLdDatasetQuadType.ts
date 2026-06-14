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

export type DatasetTermType = {
  'termType': string;
  'value': string;
};

export type DatasetLiteralTermType = DatasetTermType & {
  'datatype'?: DatasetTermType;
  'language'?: string;
};

export type JsonLdDatasetQuadType = {
  'graph': DatasetTermType;
  'object': DatasetLiteralTermType;
  'predicate': DatasetTermType;
  'subject': DatasetTermType;
};
