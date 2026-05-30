// Runnable-playground registry. Each entry pairs the VERBATIM source of a
// gate-verified example (.ts file, loaded via Vite `?raw` so there is exactly
// one source of truth — editing the file updates both the Node test and the
// in-browser playground) with the module scope its imports resolve against.
//
// The scope is the set of modules the example's runtime `import` statements
// reference, keyed by their literal specifier. The runner hands this to a
// `require` shim; type-only imports (`import type …`) are elided by the
// transpiler and need no entry. Adding a new playground means importing its
// `?raw` source plus whatever runtime modules it pulls in.

import aboxGraphSource from '../../../../examples/docs/advanced/106-abox-graph.ts?raw';
import * as bookstoreBarrel from '../../../../examples/docs/bookstore/index.js';

export interface PlaygroundExampleType {
  /** The example's verbatim TypeScript source, shown in the editor. */
  readonly source: string;
  /** Module specifier → resolved module, for the runner's `require` shim. */
  readonly modules: Readonly<Record<string, unknown>>;
}

// The bookstore examples reach all runtime values through the domain barrel
// (`bookstoreEntities` facade, schemas, `aboxFixtures`); `src/**` imports are
// type-only. Map both the explicit-extension and bare specifier forms.
const bookstoreScope: Readonly<Record<string, unknown>> = {
  '../bookstore/index.js': bookstoreBarrel,
  '../bookstore/index': bookstoreBarrel
};

export const PLAYGROUND_EXAMPLES: Readonly<Record<string, PlaygroundExampleType>> = {
  'abox-graph': {
    modules: bookstoreScope,
    source: aboxGraphSource
  }
};
