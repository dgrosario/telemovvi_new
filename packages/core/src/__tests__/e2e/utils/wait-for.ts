export type WaitForOptions = {
  timeout?: number;
  interval?: number;
  timeoutMessage?: string;
};

export class WaitForTimeoutError extends Error {
  constructor(message: string, public readonly elapsed: number) {
    super(message);
    this.name = "WaitForTimeoutError";
  }
}

export async function waitFor<T>(
  condition: () => Promise<T | null | undefined>,
  options?: WaitForOptions
): Promise<T> {
  const timeout = options?.timeout ?? 30000;
  const interval = options?.interval ?? 1000;
  const timeoutMessage =
    options?.timeoutMessage ?? `waitFor timed out after ${timeout}ms`;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();

    if (result !== null && result !== undefined) {
      return result;
    }

    await delay(interval);
  }

  throw new WaitForTimeoutError(timeoutMessage, Date.now() - startTime);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delay?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const retryDelay = options?.delay ?? 1000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await delay(retryDelay);
      }
    }
  }

  throw lastError;
}
