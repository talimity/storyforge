import type { Budget, BudgetManager } from "./types.js";

/** Default naive estimator: ~4 chars per token. */
export type TokenEstimator = (text: string) => number;

/**
 * Default implementation of BudgetManager. Tracks global and local budgets,
 * using a simple character-based token estimation by default.
 */
export class DefaultBudgetManager implements BudgetManager {
  private consumed = 0;
  private readonly scopes: number[] = []; // remaining tokens for each active local scope (outer..inner)

  constructor(
    private readonly global: Budget,
    private readonly estimate: TokenEstimator = (s) => Math.ceil((s?.length ?? 0) / 4)
  ) {}

  /** Global-only check per spec ("stop filling further slots" is a global gate). */
  hasAny(): boolean {
    const max = this.global.maxTokens ?? Number.POSITIVE_INFINITY;
    return this.consumed < max;
  }

  canFitTokenEstimate(text: string): boolean {
    const need = this.estimate(text);
    if (need <= 0) return this.hasAny(); // trivially fits/no-op

    // First, would this exceed the global limit?
    const gmax = this.global.maxTokens ?? Number.POSITIVE_INFINITY;
    if (this.consumed + need > gmax) return false;

    // Then, would this exceed ANY of the active local scope limits?
    for (const remaining of this.scopes) {
      if (need > remaining) return false;
    }
    return true;
  }

  consume(text: string): void {
    const need = this.estimate(text);
    if (need <= 0) return;

    // Consume from global budget
    this.consumed += need;

    // Consume from every active local scope (outer -> inner)
    for (let i = 0; i < this.scopes.length; i++) {
      this.scopes[i] = Math.max(0, this.scopes[i] - need);
    }
  }

  withNodeBudget(budget: Budget | undefined, thunk: () => void): void {
    const localMax = budget?.maxTokens ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(localMax)) {
      // no local ceiling; just run under global
      thunk();
      return;
    }

    this.scopes.push(Math.max(0, localMax));
    try {
      thunk();
    } finally {
      this.scopes.pop();
    }
  }
}
