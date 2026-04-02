export interface CompositionAccumulatorInterface {
  readonly 'evaluatedItems': Set<number>;
  readonly 'evaluatedProperties': Set<string>;
  'value': unknown;
}
