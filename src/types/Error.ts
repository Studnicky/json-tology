export type ErrorJsonType = {
  'cause'?: ErrorJsonType;
  'code': string;
  'message': string;
  'retryable': boolean;
};
