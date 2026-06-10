/** Typed HTTP errors for Timely webhook handlers (mapped to JSON status in routes). */
export class TimelyWebhookHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TimelyWebhookHttpError";
  }
}
