/**
 * Error classes matching @stellar/stellar-sdk Horizon error hierarchy.
 */

export class NetworkError extends Error {
  private readonly _response: any;

  constructor(message: string, response: any) {
    super(message);
    this.name = 'NetworkError';
    this._response = response;
  }

  getResponse(): any {
    return this._response;
  }
}

export class BadRequestError extends NetworkError {
  constructor(message: string, response: any) {
    super(message, response);
    this.name = 'BadRequestError';
  }
}

export class BadResponseError extends NetworkError {
  constructor(message: string, response: any) {
    super(message, response);
    this.name = 'BadResponseError';
  }
}

export class NotFoundError extends NetworkError {
  constructor(message: string, response: any) {
    super(message, response);
    this.name = 'NotFoundError';
  }
}
