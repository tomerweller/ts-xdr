/**
 * Federation — compat wrapper matching js-stellar-sdk's FederationServer.
 */

import {
  resolveFederationAddress,
  queryFederationServer,
  resolveStellarToml,
  FederationError,
  type FederationResolveOptions,
} from '@stellar/seps';

export { FederationError };

/** Maximum federation response size (100KB) */
export const FEDERATION_RESPONSE_MAX_SIZE = 100 * 1024;

export namespace Api {
  export interface Record {
    account_id: string;
    stellar_address?: string;
    memo_type?: string;
    memo?: string;
  }

  export interface Options {
    allowHttp?: boolean;
    timeout?: number;
  }
}

export class Server {
  readonly serverUrl: string;
  readonly domain: string;
  private readonly opts: Api.Options;

  constructor(serverUrl: string, domain: string, opts?: Api.Options) {
    this.serverUrl = serverUrl;
    this.domain = domain;
    this.opts = opts ?? {};
  }

  static async resolve(
    address: string,
    opts?: Api.Options,
  ): Promise<Api.Record> {
    const resolveOpts: FederationResolveOptions = {
      allowHttp: opts?.allowHttp,
      timeout: opts?.timeout,
    };
    return resolveFederationAddress(address, resolveOpts);
  }

  static async createForDomain(
    domain: string,
    opts?: Api.Options,
  ): Promise<Server> {
    const toml = await resolveStellarToml(domain, {
      allowHttp: opts?.allowHttp,
      timeout: opts?.timeout,
    });
    const federationServer = toml['FEDERATION_SERVER'];
    if (typeof federationServer !== 'string') {
      throw new FederationError(
        `stellar.toml for ${domain} does not contain FEDERATION_SERVER`,
      );
    }
    return new Server(federationServer, domain, opts);
  }

  async resolveAddress(address: string): Promise<Api.Record> {
    return queryFederationServer(
      this.serverUrl,
      { type: 'name', q: address },
      { allowHttp: this.opts.allowHttp, timeout: this.opts.timeout },
    );
  }

  async resolveAccountId(accountId: string): Promise<Api.Record> {
    return queryFederationServer(
      this.serverUrl,
      { type: 'id', q: accountId },
      { allowHttp: this.opts.allowHttp, timeout: this.opts.timeout },
    );
  }
}
