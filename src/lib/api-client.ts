/**
 * Client-side API utilities
 *
 * Provides a consistent fetch wrapper that:
 * - Always returns JSON or throws a meaningful error
 * - Handles network failures gracefully
 * - Redirects to /auth on 401
 * - Provides typed responses
 */

import type { ApiResponse, ApiError, ErrorCode } from "./api-utils";

// Re-export error codes for client use
export { ErrorCodes } from "./api-utils";
export type { ApiError, ErrorCode };

/**
 * Custom error class for API failures
 */
export class ApiClientError extends Error {
  constructor(
    public code: ErrorCode | "NETWORK_ERROR" | "PARSE_ERROR",
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Options for apiFetch
 */
interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Don't redirect to /auth on 401 */
  skipAuthRedirect?: boolean;
}

/**
 * Fetch wrapper that handles all API calls consistently
 *
 * @throws {ApiClientError} on any failure
 * @returns The `data` field from successful responses
 */
export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, skipAuthRedirect, ...fetchOptions } = options;

  // Build request options
  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  };

  // Add body if present
  if (body !== undefined) {
    requestOptions.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(url, requestOptions);
  } catch (err) {
    // Network error - no response at all
    console.error("[apiFetch] Network error:", err);
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Unable to connect. Please check your internet connection.",
      undefined,
      err
    );
  }

  // Handle 401 - redirect to auth
  if (response.status === 401 && !skipAuthRedirect) {
    if (typeof window !== "undefined") {
      // Store message for auth page to display
      sessionStorage.setItem("authMessage", "Session expired. Please sign in again.");
      window.location.href = "/auth";
    }
    throw new ApiClientError(
      "UNAUTHORIZED" as ErrorCode,
      "Session expired. Please sign in again.",
      401
    );
  }

  // Try to parse JSON response
  let json: ApiResponse<T>;

  try {
    const text = await response.text();

    // Handle empty responses
    if (!text) {
      if (response.ok) {
        // Some endpoints return empty 200/204
        return {} as T;
      }
      throw new ApiClientError(
        "PARSE_ERROR",
        `Server returned empty ${response.status} response`,
        response.status
      );
    }

    // Try to parse as JSON
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON - might be HTML error page
      console.error("[apiFetch] Non-JSON response:", text.slice(0, 200));
      throw new ApiClientError(
        "PARSE_ERROR",
        response.ok
          ? "Unexpected response format"
          : `Server error (${response.status})`,
        response.status,
        text.slice(0, 500)
      );
    }
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      "PARSE_ERROR",
      "Failed to read server response",
      response.status,
      err
    );
  }

  // Handle API error responses (ok: false)
  if (!json.ok) {
    const apiError = json.error;
    throw new ApiClientError(
      apiError.code,
      apiError.message,
      response.status,
      apiError.details
    );
  }

  // Success!
  return json.data;
}

/**
 * GET request helper
 */
export function apiGet<T>(
  url: string,
  params?: Record<string, string | undefined>,
  options?: Omit<ApiFetchOptions, "method" | "body">
): Promise<T> {
  // Build URL with query params
  let fullUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl = `${url}?${queryString}`;
    }
  }

  return apiFetch<T>(fullUrl, { ...options, method: "GET" });
}

/**
 * POST request helper
 */
export function apiPost<T>(
  url: string,
  body?: unknown,
  options?: Omit<ApiFetchOptions, "method">
): Promise<T> {
  return apiFetch<T>(url, { ...options, method: "POST", body });
}

/**
 * PUT request helper
 */
export function apiPut<T>(
  url: string,
  body?: unknown,
  options?: Omit<ApiFetchOptions, "method">
): Promise<T> {
  return apiFetch<T>(url, { ...options, method: "PUT", body });
}

/**
 * DELETE request helper
 */
export function apiDelete<T>(
  url: string,
  options?: Omit<ApiFetchOptions, "method" | "body">
): Promise<T> {
  return apiFetch<T>(url, { ...options, method: "DELETE" });
}

/**
 * Extract user-friendly error message from any error
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Check if error is a specific API error code
 */
export function isApiError(err: unknown, code: ErrorCode): boolean {
  return err instanceof ApiClientError && err.code === code;
}
