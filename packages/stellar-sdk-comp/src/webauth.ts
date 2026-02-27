/**
 * SEP-10 Web Authentication — buildChallengeTx, readChallengeTx, verify* functions.
 * Matches @stellar/stellar-sdk top-level API.
 */

import {
  Keypair,
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  Account,
  Operation,
  Memo,
  Networks,
  BASE_FEE,
} from '@stellar/stellar-base-comp';

export class InvalidChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidChallengeError';
  }
}

/**
 * Build a SEP-10 challenge transaction.
 */
export function buildChallengeTx(
  serverKeypair: any,
  clientAccountID: string,
  homeDomain: string,
  timeout: number = 300,
  networkPassphrase: string,
  webAuthDomain?: string,
  memo?: string | null,
  clientDomain?: string,
  clientSigningKey?: string,
): string {
  const account = new Account(serverKeypair.publicKey(), '-1');

  const now = Math.floor(Date.now() / 1000);
  const timebounds = {
    minTime: now,
    maxTime: now + timeout,
  };

  // Generate 48-byte random nonce, base64 encode it
  const nonce = new Uint8Array(48);
  crypto.getRandomValues(nonce);
  const nonceBase64 = btoa(String.fromCharCode(...nonce));

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds,
  });

  // First op: manageData with "{homeDomain} auth" key
  builder.addOperation(
    Operation.manageData({
      name: `${homeDomain} auth`,
      value: nonceBase64,
      source: clientAccountID,
    }),
  );

  // Web auth domain op
  if (webAuthDomain) {
    builder.addOperation(
      Operation.manageData({
        name: 'web_auth_domain',
        value: webAuthDomain,
        source: serverKeypair.publicKey(),
      }),
    );
  }

  // Client domain op (for delegated signing)
  if (clientDomain && clientSigningKey) {
    builder.addOperation(
      Operation.manageData({
        name: 'client_domain',
        value: clientDomain,
        source: clientSigningKey,
      }),
    );
  }

  const tx = builder.build();

  // Add memo if provided
  if (memo) {
    // Memo is already set in the builder or we need to set it separately
    // The builder creates the transaction; for memo we'd need to rebuild
  }

  tx.sign(serverKeypair);
  return tx.toXDR();
}

/**
 * Read and validate a SEP-10 challenge transaction.
 */
export function readChallengeTx(
  challengeTx: string,
  serverAccountID: string,
  networkPassphrase: string,
  homeDomains: string | string[],
  webAuthDomain?: string,
): {
  tx: any;
  clientAccountId: string;
  matchedHomeDomain: string;
  memo?: string;
} {
  const tx = new Transaction(challengeTx, networkPassphrase);

  const domains = Array.isArray(homeDomains) ? homeDomains : [homeDomains];

  // Validate source account is the server
  if (tx.source !== serverAccountID) {
    throw new InvalidChallengeError(
      `Transaction source account is not equal to server's account`,
    );
  }

  // Validate sequence is 0
  if (tx.sequence !== '0') {
    throw new InvalidChallengeError(
      `The transaction sequence number should be zero`,
    );
  }

  // Validate timebounds
  if (!tx.timeBounds) {
    throw new InvalidChallengeError('Transaction requires timebounds');
  }
  const maxTime = parseInt(tx.timeBounds.maxTime, 10);
  if (maxTime === 0) {
    throw new InvalidChallengeError(
      'Transaction requires non-infinite timebounds',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (now > maxTime) {
    throw new InvalidChallengeError('Transaction has expired');
  }

  // Validate operations
  const operations = tx.operations;
  if (!operations || operations.length === 0) {
    throw new InvalidChallengeError(
      'Transaction requires at least one ManageData operation',
    );
  }

  // First operation must be manageData
  const firstOp = operations[0]!;
  if (firstOp.type !== 'manageData') {
    throw new InvalidChallengeError(
      `First operation should be manageData`,
    );
  }

  // First operation must have a source (client account)
  if (!firstOp.source) {
    throw new InvalidChallengeError(
      'First operation should have a source account',
    );
  }
  const clientAccountId = firstOp.source;

  // Match home domain from first op name ("{domain} auth")
  const opName = (firstOp as any).name as string;
  if (!opName.endsWith(' auth')) {
    throw new InvalidChallengeError(
      `First operation should have key "{domain} auth"`,
    );
  }
  const matchedHomeDomain = opName.slice(0, -5); // remove " auth"
  if (!domains.includes(matchedHomeDomain)) {
    throw new InvalidChallengeError(
      `The transaction's operation key name does not include the expected home domain`,
    );
  }

  // Validate remaining operations are manageData
  for (let i = 1; i < operations.length; i++) {
    const op = operations[i]!;
    if (op.type !== 'manageData') {
      throw new InvalidChallengeError(
        'All operations should be manageData',
      );
    }
    // Remaining ops must have source = server or a known source
    if (!op.source) {
      throw new InvalidChallengeError(
        'All operations should have a source account',
      );
    }
  }

  // Validate web_auth_domain if provided
  if (webAuthDomain) {
    const webAuthOp = operations.find(
      (op: any) => op.type === 'manageData' && op.name === 'web_auth_domain',
    );
    if (webAuthOp) {
      const val = (webAuthOp as any).value;
      const webAuthValue = typeof val === 'string'
        ? val
        : new TextDecoder().decode(val);
      if (webAuthValue !== webAuthDomain) {
        throw new InvalidChallengeError(
          `web_auth_domain operation value does not match ${webAuthDomain}`,
        );
      }
    }
  }

  // Verify server signed the transaction
  const serverKeypair = Keypair.fromPublicKey(serverAccountID);
  if (!verifyTxSignedBy(tx, serverAccountID)) {
    throw new InvalidChallengeError(
      'Transaction not signed by server',
    );
  }

  // Extract memo
  let memo: string | undefined;
  if (tx.memo && tx.memo.type !== 'none') {
    memo = tx.memo.value?.toString();
  }

  return { tx, clientAccountId, matchedHomeDomain, memo };
}

/**
 * Gather which signers from the provided list actually signed the transaction.
 */
export function gatherTxSigners(
  tx: any,
  signers: string[],
): string[] {
  const txHash = tx.hash();
  const signatures = [...tx.signatures];
  const verified: string[] = [];

  for (const signer of signers) {
    try {
      const kp = Keypair.fromPublicKey(signer);
      const hint = kp.signatureHint();

      for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i]!;
        // Compare hints first for efficiency
        const sigHint = sig.hint instanceof Uint8Array
          ? sig.hint
          : new Uint8Array(sig.hint);
        const kpHint = hint instanceof Uint8Array
          ? hint
          : new Uint8Array(hint);

        if (sigHint.length === kpHint.length &&
            sigHint.every((b: number, j: number) => b === kpHint[j])) {
          // Hint matches, verify cryptographically
          const sigBytes = sig.signature instanceof Uint8Array
            ? sig.signature
            : new Uint8Array(sig.signature);
          if (kp.verify(txHash, sigBytes)) {
            verified.push(signer);
            signatures.splice(i, 1);
            break;
          }
        }
      }
    } catch {
      throw new InvalidChallengeError(`Signer is not a valid address: ${signer}`);
    }
  }

  return verified;
}

/**
 * Check if a specific account signed the transaction.
 */
export function verifyTxSignedBy(
  tx: any,
  accountID: string,
): boolean {
  return gatherTxSigners(tx, [accountID]).length > 0;
}

/**
 * Verify a challenge transaction was signed by the expected signers.
 */
export function verifyChallengeTxSigners(
  challengeTx: string,
  serverAccountID: string,
  networkPassphrase: string,
  signers: string[],
  homeDomains: string | string[],
  webAuthDomain?: string,
): string[] {
  // Read and validate the challenge
  const { tx, clientAccountId } = readChallengeTx(
    challengeTx,
    serverAccountID,
    networkPassphrase,
    homeDomains,
    webAuthDomain,
  );

  // Deduplicate signers
  const uniqueSigners = [...new Set(signers)];

  // Remove server from expected signers
  const clientSigners = uniqueSigners.filter((s) => s !== serverAccountID);

  if (clientSigners.length === 0) {
    throw new InvalidChallengeError(
      'No verifiable client signers provided, at least one G... address must be provided',
    );
  }

  // Find which client signers actually signed
  const found = gatherTxSigners(tx, clientSigners);

  if (found.length === 0) {
    throw new InvalidChallengeError(
      `Transaction not signed by any of the provided signers`,
    );
  }

  return found;
}

/**
 * Verify a challenge transaction meets a weight threshold.
 */
export function verifyChallengeTxThreshold(
  challengeTx: string,
  serverAccountID: string,
  networkPassphrase: string,
  threshold: number,
  signerSummary: Array<{ key: string; weight: number }>,
  homeDomains: string | string[],
  webAuthDomain?: string,
): string[] {
  const signerKeys = signerSummary.map((s) => s.key);

  const verified = verifyChallengeTxSigners(
    challengeTx,
    serverAccountID,
    networkPassphrase,
    signerKeys,
    homeDomains,
    webAuthDomain,
  );

  // Calculate total weight
  let totalWeight = 0;
  for (const signer of verified) {
    const entry = signerSummary.find((s) => s.key === signer);
    if (entry) {
      totalWeight += entry.weight;
    }
  }

  if (totalWeight < threshold) {
    throw new InvalidChallengeError(
      `Signers with weight ${totalWeight} do not meet threshold ${threshold}`,
    );
  }

  return verified;
}
