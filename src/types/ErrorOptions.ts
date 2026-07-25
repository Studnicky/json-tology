/**
 * Error constructor option bags.
 *
 * `code` is now a required field on every options type. This satisfies the
 * standard JavaScript `Error(message, options)` shape and the
 * `unicorn/custom-error-definition` ESLint rule.
 *
 * Object-type aliases live here per the repo convention. Each subclass options
 * type composes from {@link BaseErrorOptionsType} via `&` intersection and
 * narrows `code` to that class's own code-union.
 */

import type {
  CoercionErrorCodeType,
  GraphErrorCodeType,
  InstantiationErrorCodeType,
  MaterializationErrorCodeType,
  OwlImportErrorCodeType,
  SchemaErrorCodeType,
  SchemaLoadErrorCodeType,
  TransformErrorCodeType
} from './ErrorCodes.js';
import type { SchemaLoadReasonType } from './Loader.js';
import type { TransformDirectionType } from './TransformDirectionType.js';

export type BaseErrorOptionsType = {
  'cause'?: Error;
  'code': string;
  /**
   * Set `true` only for transient failures whose cause is external and may clear
   * on retry (e.g. HTTP 5xx). Omit (defaults to `false`) for deterministic
   * failures that recur on identical input. See {@link BaseError.retryable}.
   */
  'retryable'?: boolean;
};

export type CoercionErrorOptionsType
  = BaseErrorOptionsType & {
    'code': CoercionErrorCodeType;
  };

export type GraphErrorOptionsType
  = BaseErrorOptionsType & {
    'code': GraphErrorCodeType;
    'pointer'?: string;
  };

export type InstantiationErrorOptionsType
  = BaseErrorOptionsType & {
    'code': InstantiationErrorCodeType;
    'message'?: string;
  };

export type MaterializationErrorOptionsType
  = BaseErrorOptionsType & {
    'code': MaterializationErrorCodeType;
    'message'?: string;
    'validationErrors': string[];
  };

export type OwlImportErrorOptionsType
  = BaseErrorOptionsType & {
    'axiomIri': string;
    'code': OwlImportErrorCodeType;
    'subjectIri': null | string;
  };

export type SchemaErrorOptionsType
  = BaseErrorOptionsType & {
    'code': SchemaErrorCodeType;
    'schemaId'?: string;
  };

export type TransformErrorOptionsType
  = BaseErrorOptionsType & {
    'code': TransformErrorCodeType;
    'direction': TransformDirectionType;
    'path'?: string;
    'schemaId'?: string;
  };

export type SchemaLoadErrorOptionsType
  = BaseErrorOptionsType & {
    'code': SchemaLoadErrorCodeType;
    'file': string;
    'reason': SchemaLoadReasonType;
    'status'?: number;
  };
