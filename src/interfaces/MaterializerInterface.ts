import type { MaterializationResultType } from '../types/Materializer.js';
import type { QuadInterface } from './QuadInterface.js';
import type { InferSchemaType } from '../types/Infer.js';

import type { JsonSchemaDocumentType } from '../types/Schema.js';
import type { AboxOptionsType } from '../types/AboxOptionsType.js';

export interface MaterializerInterface {
  createDefault(schema: Record<string, unknown> & { '$id': string }): unknown;
  execute(
    schema: Record<string, unknown> & { '$id': string },
    data?: unknown,
    options?: { 'baseIri'?: string;
      'synthesizeDefaults'?: boolean }
  ): MaterializationResultType;
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
    baseIri: string,
    options?: AboxOptionsType
  ): QuadInterface[];
}
