// A minimal circuit breaker. After `failureThreshold` failures in a row it "opens" and fails fast for
// `openMs`, so we stop hammering a provider that is down (and stop making users wait for timeouts).
// After that it lets ONE trial call through ("half-open"): success closes it, failure opens it again.
// CONCEPT: circuit-breaker
//
// Trade-off: the state lives in this Lambda copy's memory. Each concurrent copy has its own breaker, and a
// cold start resets it. Sharing state across copies needs an external store (e.g. Redis, M5): more
// accurate, but one more network call and one more thing that can fail.
export class CircuitOpenError extends Error {
  name = "CircuitOpen";
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold: number,
    private readonly openMs: number,
    private readonly now: () => number = Date.now, // injectable clock, for tests
  ) {}

  get state(): "CLOSED" | "OPEN" | "HALF_OPEN" {
    if (this.openedAt === null) return "CLOSED";
    return this.now() - this.openedAt < this.openMs ? "OPEN" : "HALF_OPEN";
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") throw new CircuitOpenError("Payment provider circuit is open; failing fast.");
    try {
      const result = await fn();
      this.failures = 0; // a success (also the half-open trial) closes the circuit
      this.openedAt = null;
      return result;
    } catch (error) {
      this.failures++;
      if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) this.openedAt = this.now();
      throw error;
    }
  }
}
