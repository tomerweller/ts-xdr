// Example using the modern ts-stellar-xdr packages (from README)
import { Keypair, TransactionBuilder, Networks, createAccount } from '@stellar/tx-builder';
import { RpcClient } from '@stellar/rpc-client';
import { FriendbotClient } from '@stellar/friendbot-client';

// Create keypairs
const alice = await Keypair.random();
const bob = await Keypair.random();

// Fund alice on testnet
const friendbot = new FriendbotClient('https://friendbot.stellar.org');
await friendbot.fund(alice.publicKey);

// Fetch alice's sequence number
const rpc = new RpcClient('https://soroban-testnet.stellar.org');
const account = await rpc.getAccount(alice.publicKey);

// Build, sign, and submit a CreateAccount transaction
const tx = await new TransactionBuilder(
  { address: alice.publicKey, sequenceNumber: account.seqNum },
  { fee: 100, networkPassphrase: Networks.TESTNET },
)
  .setTimeout(300)
  .addOperation(createAccount({ destination: bob.publicKey, startingBalance: 100_0000000n }))
  .build();

await tx.sign(alice);
const result = await rpc.sendTransaction(tx.toTransactionEnvelope());
const confirmed = await rpc.pollTransaction(result.hash);
console.log(confirmed);
