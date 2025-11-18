/**
 * Async Utilities - Handle async operations and delays
 */
export class AsyncUtils {
  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get nullable result from promise with error handling
   */
  static async getNullableResult<T>(
    promise: Promise<T>,
    options?: { defaultValue?: T; logError?: boolean }
  ): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      if (options?.logError) {
        console.error('Promise error:', error);
      }
      return options?.defaultValue ?? null;
    }
  }

  /**
   * Retry async operation with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await this.sleep(delay * Math.pow(2, i));
        }
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
}

