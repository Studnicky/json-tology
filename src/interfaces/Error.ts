export interface ErrorJsonInterface {
  'cause'?: ErrorJsonInterface;
  'code': string;
  'message': string;
  'retryable': boolean;
}
