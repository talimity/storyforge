import type { Budget, BudgetManager } from "./types.js";

/** Default naive estimator: ~4 chars per token. */
export type TokenEstimator = (text: string) => number;

/**
 * Budget manager that tracks global consumption, nested node budgets, and
 * logical lane reservations. A single instance lives for the full render.
 */
export class DefaultBudgetManager implements BudgetManager {
  /** Total estimated tokens consumed across the prompt. */
  private consumed = 0;
  /** Remaining ceilings for active node budgets (outermost first). */
  private readonly scopes: number[] = [];
  /**
   * Lane identifiers active on the call stack; used to attribute consumption to
   * the correct reserve.
   */
  private readonly laneStack: (string | null)[] = [];
  /**
   * Protected token reserves keyed by lane id. Only work in the lane may draw
   * from its floor.
   */
  private readonly laneFloors = new Map<string, number>();

  constructor(
    private readonly global: Budget,
    private readonly estimate: TokenEstimator = (s) => Math.ceil((s?.length ?? 0) / 4)
  ) {}

  /** Global-only check per spec ("stop filling further slots" is a global gate). */
  hasAny(): boolean {
    const max = this.global.maxTokens ?? Number.POSITIVE_INFINITY;
    const remaining = max - this.consumed;
    if (remaining <= 0) return false;
    const lane = this.currentLane();
    const floors = this.totalFloors(lane);
    return remaining > floors;
  }

  canFitTokenEstimate(text: string): boolean {
    const need = this.estimate(text);
    if (need <= 0) return this.hasAny(); // trivially fits/no-op

    // First, would this exceed the global limit?
    const gmax = this.global.maxTokens ?? Number.POSITIVE_INFINITY;
    if (this.consumed + need > gmax) return false;

    const lane = this.currentLane();
    const available = gmax - this.consumed;
    const protection = this.totalFloors(lane);

    if (lane == null) {
      if (need > available - protection) return false;
    } else {
      const allowed = available - protection;
      if (need > allowed) return false;
    }

    // Then, would this exceed ANY of the active local scope limits?
    for (const remaining of this.scopes) {
      if (need > remaining) return false;
    }
    return true;
  }

  consume(text: string): void {
    // Actual consumption happens after checks pass so the global counter and all active budgets stay in sync.
    const need = this.estimate(text);
    if (need <= 0) return;

    // Consume from global budget
    this.consumed += need;

    // Consume from every active local scope (outer -> inner)
    for (let i = 0; i < this.scopes.length; i++) {
      this.scopes[i] = Math.max(0, this.scopes[i] - need);
    }

    const lane = this.currentLane();
    if (lane != null) {
      const current = this.laneFloors.get(lane);
      if (current !== undefined) {
        const next = current - need;
        this.laneFloors.set(lane, next > 0 ? next : 0);
      }
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

  estimateTokens(text: string): number {
    return this.estimate(text);
  }

  reserveFloor(laneId: string, tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    const existing = this.laneFloors.get(laneId) ?? 0;
    // Floors accumulate so multiple reservations can protect the same lane.
    this.laneFloors.set(laneId, existing + tokens);
  }

  releaseFloor(laneId: string, tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    const existing = this.laneFloors.get(laneId);
    if (existing === undefined) return;
    // Release returns unused floor tokens to the global pool.
    const next = existing - tokens;
    if (next > 0) {
      this.laneFloors.set(laneId, next);
    } else {
      this.laneFloors.delete(laneId);
    }
  }

  withLane<T>(laneId: string | null, thunk: () => T): T {
    this.laneStack.push(laneId);
    try {
      return thunk();
    } finally {
      this.laneStack.pop();
    }
  }

  private currentLane(): string | null {
    return this.laneStack.length ? this.laneStack[this.laneStack.length - 1] : null;
  }

  private totalFloors(excludeLane: string | null): number {
    let total = 0;
    for (const [lane, value] of this.laneFloors) {
      if (value <= 0) continue;
      if (excludeLane != null && lane === excludeLane) continue;
      total += value;
    }
    return total;
  }
}
