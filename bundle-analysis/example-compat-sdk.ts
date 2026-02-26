// Equivalent example using the @stellar/stellar-sdk-comp compatibility layer
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  BASE_FEE,
  SorobanRpc,
} from '@stellar/stellar-sdk-comp';

// Create keypairs
const alice = Keypair.random();
const bob = Keypair.random();

// Fund alice on testnet
const friendbotResp = await fetch(
  `https://friendbot.stellar.org?addr=${encodeURIComponent(alice.publicKey())}`,
);
await friendbotResp.json();

// Fetch alice's sequence number
const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const account = await rpc.getAccount(alice.publicKey());

// Build, sign, and submit a CreateAccount transaction
const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.createAccount({
      destination: bob.publicKey(),
      startingBalance: '10',
    }),
  )
  .setTimeout(300)
  .build();

tx.sign(alice);
const result = await rpc.sendTransaction(tx);
console.log(result);
