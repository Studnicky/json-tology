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
import type { TransformDirectionType } from './TransformDirection.js';

export type BaseErrorOptionsType = {
  readonly 'cause'?: Error;
  readonly 'code': string;
  /**
   * Set `true` only for transient failures whose cause is external and may clear
   * on retry (e.g. HTTP 5xx). Omit (defaults to `false`) for deterministic
   * failures that recur on identical input. See {@link BaseError.retryable}.
   */
  readonly 'retryable'?: boolean;
};

export type CoercionErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': CoercionErrorCodeType;
  };

export type GraphErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': GraphErrorCodeType;
    readonly 'pointer'?: string;
  };

export type InstantiationErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': InstantiationErrorCodeType;
    readonly 'message'?: string;
  };

export type MaterializationErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': MaterializationErrorCodeType;
    readonly 'message'?: string;
    readonly 'validationErrors': string[];
  };

export type OwlImportErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'axiomIri': string;
    readonly 'code': OwlImportErrorCodeType;
    readonly 'subjectIri': null | string;
  };

export type SchemaErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': SchemaErrorCodeType;
    readonly 'schemaId'?: string;
  };

export type TransformErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': TransformErrorCodeType;
    readonly 'direction': TransformDirectionType;
    readonly 'path'?: string;
    readonly 'schemaId'?: string;
  };

export type SchemaLoadErrorOptionsType
  = Omit<BaseErrorOptionsType, 'code'> & {
    readonly 'code': SchemaLoadErrorCodeType;
    readonly 'file': string;
    readonly 'reason': SchemaLoadReasonType;
    readonly 'status'?: number;
  };
