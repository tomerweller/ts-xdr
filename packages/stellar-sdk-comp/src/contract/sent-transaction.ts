/**
 * SentTransaction — represents a transaction that has been submitted to the network.
 * Handles polling for completion.
 * Matches @stellar/stellar-sdk SentTransaction API.
 */

import type { AssembledTransaction, Watcher } from './assembled-transaction.js';

export class SentTransaction<T> {
  public server: any;
  public sendTransactionResponse?: any;
  public getTransactionResponseAll?: any[];
  public getTransactionResponse?: any;

  static Errors = {
    SendFailed: class SendFailedError extends Error {
      constructor(message?: string) {
        super(message ?? 'Sending the transaction to the network failed');
        this.name = 'SendFailedError';
      }
    },
    SendResultOnly: class SendResultOnlyError extends Error {
      constructor(message?: string) {
        super(message ?? 'Transaction was sent but only the send result is available');
        this.name = 'SendResultOnlyError';
      }
    },
    TransactionStillPending: class TransactionStillPendingError extends Error {
      constructor(message?: string) {
        super(message ?? 'Transaction is still pending after polling');
        this.name = 'TransactionStillPendingError';
      }
    },
  };

  constructor(public assembled: AssembledTransaction<T>) {
    this.server = assembled.server;
  }

  static async init<U>(
    assembled: AssembledTransaction<U>,
    watcher?: Watcher,
  ): Promise<SentTransaction<U>> {
    const sent = new SentTransaction(assembled);
    await sent._send(watcher);
    return sent;
  }

  private async _send(watcher?: Watcher): Promise<void> {
    const txToSend = this.assembled.signed ?? this.assembled.built;
    if (!txToSend) {
      throw new SentTransaction.Errors.SendFailed('Transaction has not been built or signed');
    }

    // Send the transaction
    this.sendTransactionResponse = await this.server.sendTransaction(txToSend);
    watcher?.onSubmitted?.(this.sendTransactionResponse);

    if (this.sendTransactionResponse.status === 'ERROR') {
      throw new SentTransaction.Errors.SendFailed(
        `Transaction send failed: ${JSON.stringify(this.sendTransactionResponse)}`,
      );
    }

    // Poll for completion
    const hash = this.sendTransactionResponse.hash;
    if (!hash) {
      throw new SentTransaction.Errors.SendFailed('No transaction hash in send response');
    }

    this.getTransactionResponseAll = [];
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await this.server.getTransaction(hash);
      this.getTransactionResponseAll.push(response);
      watcher?.onProgress?.(response);

      if (response.status !== 'NOT_FOUND') {
        this.getTransactionResponse = response;
        return;
      }
    }

    throw new SentTransaction.Errors.TransactionStillPending(
      `Transaction ${hash} still pending after ${maxAttempts} attempts`,
    );
  }

  /**
   * Get the parsed result from the completed transaction.
   */
  get result(): T {
    if (!this.getTransactionResponse) {
      throw new SentTransaction.Errors.SendResultOnly();
    }

    if (this.getTransactionResponse.status === 'FAILED') {
      throw new SentTransaction.Errors.SendFailed('Transaction failed on chain');
    }

    const returnValue = this.getTransactionResponse.returnValue;
    if (returnValue && this.assembled.options.parseResultXdr) {
      return this.assembled.options.parseResultXdr(returnValue);
    }

    return returnValue as T;
  }
}
