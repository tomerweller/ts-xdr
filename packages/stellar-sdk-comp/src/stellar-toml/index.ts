/**
 * StellarToml — compat wrapper matching js-stellar-sdk's StellarTomlResolver.
 */

import {
  resolveStellarToml,
  StellarTomlError,
  type StellarTomlResolveOptions,
} from '@stellar/seps';

export { StellarTomlError };

/** Maximum response size for stellar.toml (100KB) */
export const STELLAR_TOML_MAX_SIZE = 100 * 1024;

export namespace Api {
  export interface StellarTomlResolveOptions {
    allowHttp?: boolean;
    timeout?: number;
  }

  export interface StellarToml extends Record<string, unknown> {
    FEDERATION_SERVER?: string;
    AUTH_SERVER?: string;
    TRANSFER_SERVER?: string;
    TRANSFER_SERVER_SEP0024?: string;
    KYC_SERVER?: string;
    WEB_AUTH_ENDPOINT?: string;
    SIGNING_KEY?: string;
    HORIZON_URL?: string;
    ACCOUNTS?: string[];
    VERSION?: string;
    NETWORK_PASSPHRASE?: string;
    DOCUMENTATION?: Documentation;
    PRINCIPALS?: Principal[];
    CURRENCIES?: Currency[];
    VALIDATORS?: Validator[];
  }

  export interface Documentation {
    ORG_NAME?: string;
    ORG_DBA?: string;
    ORG_URL?: string;
    ORG_LOGO?: string;
    ORG_DESCRIPTION?: string;
    ORG_PHYSICAL_ADDRESS?: string;
    ORG_PHYSICAL_ADDRESS_ATTESTATION?: string;
    ORG_PHONE_NUMBER?: string;
    ORG_PHONE_NUMBER_ATTESTATION?: string;
    ORG_KEYBASE?: string;
    ORG_TWITTER?: string;
    ORG_GITHUB?: string;
    ORG_OFFICIAL_EMAIL?: string;
    ORG_SUPPORT_EMAIL?: string;
    ORG_LICENSING_AUTHORITY?: string;
    ORG_LICENSE_TYPE?: string;
    ORG_LICENSE_NUMBER?: string;
  }

  export interface Validator {
    ALIAS?: string;
    DISPLAY_NAME?: string;
    HOST?: string;
    PUBLIC_KEY?: string;
    HISTORY?: string;
  }

  export interface Principal {
    name?: string;
    email?: string;
    keybase?: string;
    telegram?: string;
    twitter?: string;
    github?: string;
    id_photo_hash?: string;
    verification_photo_hash?: string;
  }

  export interface Currency {
    code?: string;
    code_template?: string;
    issuer?: string;
    status?: string;
    display_decimals?: number;
    name?: string;
    desc?: string;
    conditions?: string;
    image?: string;
    fixed_number?: number;
    max_number?: number;
    is_unlimited?: boolean;
    is_asset_anchored?: boolean;
    anchor_asset_type?: string;
    anchor_asset?: string;
    attestation_of_reserve?: string;
    redemption_instructions?: string;
  }
}

export class Resolver {
  static async resolve(
    domain: string,
    opts?: Api.StellarTomlResolveOptions,
  ): Promise<Api.StellarToml> {
    const resolveOpts: StellarTomlResolveOptions = {
      allowHttp: opts?.allowHttp,
      timeout: opts?.timeout,
    };
    return resolveStellarToml(domain, resolveOpts) as Promise<Api.StellarToml>;
  }
}
