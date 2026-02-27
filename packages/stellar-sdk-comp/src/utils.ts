/**
 * Utils — SDK utility functions matching @stellar/stellar-sdk.
 */

export const Utils = {
  /**
   * Validate that the current time falls within a transaction's timebounds.
   * @param transaction - A transaction with timeBounds property
   * @param gracePeriod - Optional grace period in seconds (default 0)
   */
  validateTimebounds(transaction: any, gracePeriod = 0): boolean {
    const timeBounds = transaction.timeBounds;
    if (!timeBounds) return false;

    const now = Math.floor(Date.now() / 1000);
    const minTime = parseInt(timeBounds.minTime, 10) || 0;
    const maxTime = parseInt(timeBounds.maxTime, 10) || 0;

    if (maxTime === 0) {
      // maxTime of 0 means no upper bound
      return now >= minTime - gracePeriod;
    }

    return now >= minTime - gracePeriod && now <= maxTime + gracePeriod;
  },
};
