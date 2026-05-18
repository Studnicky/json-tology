import type { MaterializationResultInterface } from './Materializer.js';
import type { QuadInterface } from './Quad.js';
import type { InferSchemaType } from '../types/Infer.js';
import type { SkolemizeFnType } from '../types/Skolemize.js';
import type { JsonSchemaDocumentType } from '../types/Schema.js';

export interface MaterializerInterface {
  createDefault(schema: Record<string, unknown> & { '$id': string }): unknown;
  execute(
    schema: Record<string, unknown> & { '$id': string },
    data?: unknown,
    options?: { 'baseIRI'?: string;
      'synthesizeDefaults'?: boolean }
  ): MaterializationResultInterface;
  materialize<TSchema extends JsonSchemaDocumentType & { readonly '$id': string }>(
    schema: TSchema,
    partial?: Partial<InferSchemaType<TSchema>>,
  ): InferSchemaType<TSchema>;
  materialize(
    schema: Record<string, unknown> & { '$id': string },
    partial?: Record<string, unknown>
  ): unknown;
  projectAbox(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown,
    baseIRI: string,
    options?: { 'graphIRI'?: string | undefined;
      'iriFor'?: SkolemizeFnType | undefined }
  ): QuadInterface[];
}
