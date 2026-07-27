/** An error with an HTTP status, so handlers can fail with intent. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = "Authentication required") => new ApiError(401, message);
export const forbidden = (message: string) => new ApiError(403, message);
export const notFound = (message: string) => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
export const tooMany = (message = "Too many requests — slow down") => new ApiError(429, message);
