/**
 * PropIndexEntryType — internal per-property accumulator built during the graph
 * traversal pass in the Properties dispatcher.
 */

export type PropIndexEntryType = {
  'domains': string[];
  'inverseOf': string[];
  'propertyIri': string;
  'range': null | string;
  'subPropertyOf': string[];
  'type': 'datatype' | 'object';
};
