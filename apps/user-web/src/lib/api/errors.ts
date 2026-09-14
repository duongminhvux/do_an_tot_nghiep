export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) { super(message); this.name = "ApiError"; }
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
