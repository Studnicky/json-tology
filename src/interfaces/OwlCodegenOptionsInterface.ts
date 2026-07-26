import type { InferType } from '../types/Schema.js';
import type { OWL_CODEGEN_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options controlling the shape of the generated TypeScript source.
 *
 * A consumer-facing option bag with `exactOptionalPropertyTypes`-style
 * `| undefined` fields — TS-only ergonomics, not JSON-representable data —
 * so it is authored as an interface extending the schema-derived base rather
 * than a `type`.
 *
 * @experimental This surface is subject to change before 1.0. Generated code
 * shapes and option names may evolve as the codegen path matures.
 */
export interface OwlCodegenOptionsInterface extends InferType<typeof OWL_CODEGEN_OPTIONS_SCHEMA> {
  /**
   * Base IRI used in the `JsonTology.create` call. Defaults to empty string,
   * which causes the generator to derive it from the first schema $id.
   */
  'baseIri'?: string | undefined;

  /**
   * Extra comment lines inserted immediately after the auto-generated banner.
   * Each element is emitted as a separate `// ` comment line.
   */
  'header'?: string[] | undefined;

  /**
   * Import path for `InferType`. Defaults to `'json-tology/types'`.
   */
  'inferTypeImportPath'?: string | undefined;

  /**
   * Name of the exported registry array constant and registry instance.
   * E.g. `'foaf'` → `foafSchemas`, `foaf`.
   * Defaults to `'registry'`.
   */
  'registryConstName'?: string | undefined;

  /**
   * Human-readable label for the source (file path or IRI) emitted in the
   * auto-generated banner.
   */
  'sourceLabel'?: string | undefined;
}
