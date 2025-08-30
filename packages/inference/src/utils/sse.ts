/**
 * A single Server-Sent Event record.
 * - Multiple `data:` lines in a record are joined with "\n"
 * - Unknown fields are ignored per spec
 */
export interface SSEEvent {
  event?: string; // from `event:`
  data?: string; // joined data payload (may be empty string)
  id?: string; // from `id:`
  retry?: number; // from `retry:`
}

export interface SSEOptions {
  /**
   * When true (default), iteration stops when an event's data equals "[DONE]".
   * If you want to receive the DONE record too, set yieldDone: true.
   */
  stopOnDone?: boolean;
  /** Whether to yield the DONE record if stopOnDone is true. Default false. */
  yieldDone?: boolean;
  /**
   * Custom predicate to detect stream-termination events. Defaults to
   * s.trim() === "[DONE]".
   */
  isDone?: (data: string) => boolean;
}

/**
 * Async generator that yields parsed SSE records from a ReadableStream<Uint8Array>.
 *
 * Usage:
 *   for await (const evt of iterateSSE(response.body!)) {
 *     if (!evt.data) continue;
 *     const obj = JSON.parse(evt.data);
 *     // ...
 *   }
 */
export async function* iterateSSE(
  stream: ReadableStream<Uint8Array>,
  opts: SSEOptions = {}
): AsyncGenerator<SSEEvent> {
  if (!stream) {
    throw new Error("iterateSSE: missing readable stream");
  }

  const stopOnDone = opts.stopOnDone ?? true;
  const yieldDone = opts.yieldDone ?? false;
  const isDone =
    opts.isDone ??
    ((s: string) => {
      return s.trim() === "[DONE]";
    });

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  // Per-event accumulators
  let eventName: string | undefined;
  let lastEventId: string | undefined; // id is sticky between events per spec
  let lastRetry: number | undefined;
  let dataLines: string[] = [];

  async function* processEvents() {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush any pending event on stream end
        if (dataLines.length > 0 || eventName || lastRetry) {
          const evt = createEvent();
          if (shouldYield(evt)) {
            yield evt;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      // Normalize to \n line endings; handle CRLF by stripping trailing \r
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (let rawLine of lines) {
        if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
        const line = rawLine;

        // Empty line => record boundary
        if (line === "") {
          if (dataLines.length > 0 || eventName || lastRetry) {
            const evt = createEvent();
            const shouldStop = checkDone(evt);
            if (shouldStop && !yieldDone) {
              // Stop without yielding the DONE event
              await reader.cancel().catch(() => {});
              return;
            }
            if (shouldYield(evt)) {
              yield evt;
            }
            if (shouldStop) {
              await reader.cancel().catch(() => {});
              return;
            }
          }
          continue;
        }

        // Comment line
        if (line.startsWith(":")) continue;

        // Field parsing: "field: value" (value optional)
        const colonIdx = line.indexOf(":");
        let field = line;
        let value = "";

        if (colonIdx !== -1) {
          field = line.slice(0, colonIdx);
          value = line.slice(colonIdx + 1);
          if (value.startsWith(" ")) value = value.slice(1);
        }

        switch (field) {
          case "event":
            eventName = value;
            break;
          case "data":
            // Multiple data lines are joined with "\n"
            dataLines.push(value);
            break;
          case "id":
            // Per spec, an "id" field with no value resets the id to empty string
            lastEventId = value;
            break;
          case "retry": {
            const ms = Number.parseInt(value, 10);
            if (Number.isFinite(ms)) {
              lastRetry = ms;
            }
            break;
          }
          default:
            // Unknown field: ignore
            break;
        }
      }
    }
  }

  function createEvent(): SSEEvent {
    const data = dataLines.join("\n");
    const evt: SSEEvent = {
      event: eventName,
      data,
      id: lastEventId,
      retry: lastRetry,
    };

    // Reset per-event (id/retry persist unless overwritten)
    eventName = undefined;
    dataLines = [];

    return evt;
  }

  function checkDone(evt: SSEEvent): boolean {
    return stopOnDone && typeof evt.data === "string" && isDone(evt.data);
  }

  function shouldYield(evt: SSEEvent): boolean {
    // Always yield unless it's a DONE event and yieldDone is false
    if (checkDone(evt) && !yieldDone) {
      return false;
    }
    return true;
  }

  try {
    yield* processEvents();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* no-op */
    }
  }
}
