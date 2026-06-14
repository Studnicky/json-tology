export type DuplicateReportEntryType<TEquivalentTo extends string = string> = {
  readonly 'equivalentTo': TEquivalentTo;
  readonly 'pointer': string;
  readonly 'schemaId': string;
  readonly 'shape': Record<string, unknown>;
};
