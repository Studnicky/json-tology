/**
 * Skolemize — IRI minting strategy function shape.
 *
 * A skolemize function receives a context describing where in the
 * instance tree projection currently sits and returns either an IRI
 * for the current subject, or `undefined` to fall through to the next
 * strategy in a `Skolemize.compose` chain (or to the default
 * `Skolemize.hash` minter when used standalone).
 */
export type SkolemizeFnType = (ctx: {
  'depth': number;
  'path': string;
  'value': unknown;
}) => string | undefined;
