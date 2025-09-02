/**
 * A queue that allows async iteration over items as they are pushed.
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: Array<(value: IteratorResult<T>) => void> = [];
  private closed = false;

  /**
   * Push an item to the queue. If there's a waiting consumer,
   * deliver immediately. Otherwise, buffer the item.
   */
  push(item: T): void {
    if (this.closed) {
      throw new Error("Cannot push to a closed queue");
    }

    const resolver = this.resolvers.shift();
    if (resolver) {
      // Deliver immediately to waiting consumer
      resolver({ done: false, value: item });
    } else {
      // Buffer for future consumption
      this.queue.push(item);
    }
  }

  /**
   * Create an async iterator over the queue items.
   * Will yield buffered items first, then wait for new items.
   * Iteration ends when the queue is closed.
   */
  async *iterate(): AsyncIterableIterator<T> {
    while (true) {
      if (this.queue.length > 0) {
        // Yield buffered items
        const item = this.queue.shift();
        if (item !== undefined) {
          yield item;
        }
      } else if (this.closed) {
        // Queue is closed and empty, end iteration
        return;
      } else {
        // Wait for next item or closure
        const { done, value } = await new Promise<IteratorResult<T>>(
          (resolve) => this.resolvers.push(resolve)
        );
        if (done) return;
        yield value;
      }
    }
  }

  /**
   * Close the queue, preventing new items from being pushed.
   * Any waiting consumers will be notified that iteration is done.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    // Notify all waiting consumers that iteration is done
    for (const resolver of this.resolvers) {
      resolver({ done: true, value: undefined });
    }
    this.resolvers = [];
  }

  /**
   * Check if the queue is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the current size of the buffered queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear all buffered items (does not affect closure state)
   */
  clear(): void {
    this.queue = [];
  }
}
