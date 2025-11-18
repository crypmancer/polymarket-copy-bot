/**
 * Math Utilities - Handle mathematical calculations
 */
export class MathUtils {
  /**
   * Calculate non-decimal value (multiply by 10^decimals)
   */
  static calcNonDecimalValue(value: number, decimals: number): number {
    return Math.trunc(value * Math.pow(10, decimals));
  }

  /**
   * Calculate decimal value (divide by 10^decimals)
   */
  static calcDecimalValue(value: number, decimals: number): number {
    return value / Math.pow(10, decimals);
  }
}

