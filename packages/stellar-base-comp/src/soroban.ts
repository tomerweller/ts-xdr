/**
 * Soroban static utility namespace matching js-stellar-base.
 */

export const Soroban = {
  /**
   * Format a raw integer token amount into a human-readable decimal string.
   * @param amount - Raw integer amount as string (e.g., "10000000")
   * @param decimals - Number of decimal places (e.g., 7)
   * @returns Formatted amount (e.g., "1.0000000")
   */
  formatTokenAmount(amount: string, decimals: number): string {
    if (decimals === 0) return amount;

    const negative = amount.startsWith('-');
    let abs = negative ? amount.slice(1) : amount;

    // Pad with leading zeros if needed
    while (abs.length <= decimals) {
      abs = '0' + abs;
    }

    const intPart = abs.slice(0, abs.length - decimals);
    const fracPart = abs.slice(abs.length - decimals);

    return (negative ? '-' : '') + intPart + '.' + fracPart;
  },

  /**
   * Parse a human-readable decimal string into a raw integer amount string.
   * @param value - Display value (e.g., "1.5")
   * @param decimals - Number of decimal places (e.g., 7)
   * @returns Raw integer amount (e.g., "15000000")
   */
  parseTokenAmount(value: string, decimals: number): string {
    const negative = value.startsWith('-');
    let abs = negative ? value.slice(1) : value;

    const parts = abs.split('.');
    const intPart = parts[0] ?? '0';
    let fracPart = parts[1] ?? '';

    if (fracPart.length > decimals) {
      throw new Error(
        `Too many decimal places (max ${decimals}, got ${fracPart.length})`,
      );
    }

    // Pad fraction with trailing zeros
    while (fracPart.length < decimals) {
      fracPart += '0';
    }

    // Remove leading zeros but keep at least one digit
    let result = (intPart + fracPart).replace(/^0+/, '') || '0';
    return (negative ? '-' : '') + result;
  },
};
