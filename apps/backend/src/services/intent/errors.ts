export class IntentCancelledError extends Error {
  constructor() {
    super("Intent run was aborted by client");
  }
}
