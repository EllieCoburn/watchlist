/**
 * Sliding-window request budget per server instance. When the budget is spent the caller
 * should serve cached or modeled data instead of calling the provider.
 */
export class RateBudget {
  private stamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Reserves one request if the budget allows. */
  take(now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    while (this.stamps.length && this.stamps[0] <= cutoff) this.stamps.shift();
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }

  remaining(now = Date.now()): number {
    const cutoff = now - this.windowMs;
    return Math.max(0, this.limit - this.stamps.filter((t) => t > cutoff).length);
  }
}
