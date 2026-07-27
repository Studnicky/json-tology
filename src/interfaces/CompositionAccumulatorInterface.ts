export interface CompositionAccumulatorInterface {
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'value': unknown;
}
