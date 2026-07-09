export type DuplicateReportEntryType<TEquivalentTo extends string = string> = {
  'equivalentTo': TEquivalentTo;
  'pointer': string;
  'schemaId': string;
  'shape': Record<string, unknown>;
};
