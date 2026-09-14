export class AdminApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";
