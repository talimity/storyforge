export class AsyncBroadcast {
  private waiters = new Set<(r: IteratorResult<void>) => void>();
  private closed = false;

  push(): void {
    if (this.closed) throw new Error("Broadcast closed");
    const list = [...this.waiters];
    this.waiters.clear();
    for (const resolve of list) resolve({ done: false, value: undefined });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.waiters) resolve({ done: true, value: undefined });
    this.waiters.clear();
  }

  isClosed() {
    return this.closed;
  }

  async *iterate(): AsyncIterableIterator<void> {
    while (!this.closed) {
      const next = new Promise<IteratorResult<void>>((resolve) => this.waiters.add(resolve));
      const { done } = await next;
      if (done) return;
      yield;
    }
  }
}
