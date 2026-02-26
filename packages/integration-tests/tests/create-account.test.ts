import { Keypair, TransactionBuilder, Networks, createAccount } from '@stellar/tx-builder';
import { RpcClient } from '@stellar/rpc-client';
import { FriendbotClient } from '@stellar/friendbot-client';
import { describe, it, expect } from 'vitest';

const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
const TESTNET_FRIENDBOT = 'https://friendbot.stellar.org';

describe('create account on testnet', () => {
  it('funds alice, then alice creates bob', async () => {
    // 1. Two random keypairs
    const alice = await Keypair.random();
    const bob = await Keypair.random();

    // 2. Fund alice via friendbot
    const friendbot = new FriendbotClient(TESTNET_FRIENDBOT);
    const fundResult = await friendbot.fund(alice.publicKey);
    expect(fundResult.hash).toBeDefined();

    // 3. Fetch alice's sequence number
    const rpc = new RpcClient(TESTNET_RPC);
    const aliceAccount = await rpc.getAccount(alice.publicKey);

    // 4. Build CreateAccount tx
    const tx = await new TransactionBuilder(
      { address: alice.publicKey, sequenceNumber: aliceAccount.seqNum },
      { fee: 100, networkPassphrase: Networks.TESTNET },
    )
      .setTimeout(300)
      .addOperation(createAccount({
        destination: bob.publicKey,
        startingBalance: 100_0000000n,
      }))
      .build();

    // 5. Sign & submit
    await tx.sign(alice);
    const sendResult = await rpc.sendTransaction(tx.toTransactionEnvelope());
    expect(sendResult.status).toBe('PENDING');

    // 6. Poll until confirmed
    const confirmed = await rpc.pollTransaction(sendResult.hash);
    expect(confirmed.status).toBe('SUCCESS');

    // 7. Verify bob's account
    const bobAccount = await rpc.getAccount(bob.publicKey);
    expect(bobAccount.balance).toBe(100_0000000n);
  });
});
