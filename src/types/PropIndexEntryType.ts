/**
 * PropIndexEntryType — internal per-property accumulator built during the graph
 * traversal pass in the Properties dispatcher.
 */

export type PropIndexEntryType = {
  readonly 'domains': string[];
  readonly 'inverseOf': string[];
  readonly 'propertyIri': string;
  readonly 'range': null | string;
  readonly 'subPropertyOf': string[];
  readonly 'type': 'datatype' | 'object';
};
