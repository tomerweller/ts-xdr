/**
 * Config — global SDK configuration matching @stellar/stellar-sdk.
 */

let _allowHttp = false;
let _timeout = 0;

export const Config = {
  setAllowHttp(allowHttp: boolean): void {
    _allowHttp = allowHttp;
  },
  isAllowHttp(): boolean {
    return _allowHttp;
  },
  setTimeout(timeout: number): void {
    _timeout = timeout;
  },
  getTimeout(): number {
    return _timeout;
  },
  setDefault(): void {
    _allowHttp = false;
    _timeout = 0;
  },
};
