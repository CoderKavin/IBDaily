/**
 * API Utilities - Consistent error handling for all API routes
 *
 * Response Contract:
 * - Success: { ok: true, data: ... }
 * - Error: { ok: false, error: { code: string, message: string, details?: any } }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// Error codes for client handling
export const ErrorCodes = {
  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_JSON: "INVALID_JSON",
  MISSING_PARAM: "MISSING_PARAM",

  // Database errors
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE: "DUPLICATE",
  DB_ERROR: "DB_ERROR",

  // Business logic errors
  COHORT_LOCKED: "COHORT_LOCKED",
  NOT_MEMBER: "NOT_MEMBER",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Generate unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Create success response with no-cache headers
export function success<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { ok: true, data },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

// Create error response
export function error(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, details },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// Common error helpers
export const errors = {
  unauthorized: (message = "Please sign in to continue") =>
    error(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message = "You don't have permission to do this") =>
    error(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (message = "Resource not found") =>
    error(ErrorCodes.NOT_FOUND, message, 404),

  validation: (message: string, details?: unknown) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  missingParam: (param: string) =>
    error(ErrorCodes.MISSING_PARAM, `${param} is required`, 400),

  notMember: (message = "You are not a member of this cohort") =>
    error(ErrorCodes.NOT_MEMBER, message, 403),

  cohortLocked: (message = "Trial has ended. Activate membership to continue.") =>
    error(ErrorCodes.COHORT_LOCKED, message, 403),

  duplicate: (message = "This resource already exists") =>
    error(ErrorCodes.DUPLICATE, message, 409),

  internal: (message = "Something went wrong. Please try again.") =>
    error(ErrorCodes.INTERNAL_ERROR, message, 500),
};

// Map Prisma errors to API errors
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): NextResponse<ApiErrorResponse> {
  switch (err.code) {
    case "P2002": // Unique constraint violation
      return error(
        ErrorCodes.DUPLICATE,
        "This record already exists",
        409,
        { field: err.meta?.target }
      );
    case "P2025": // Record not found
      return error(ErrorCodes.NOT_FOUND, "Record not found", 404);
    case "P2003": // Foreign key constraint
      return error(ErrorCodes.VALIDATION_ERROR, "Related record not found", 400);
    default:
      console.error(`[Prisma Error] Code: ${err.code}`, err.message);
      return errors.internal();
  }
}

// Session type with guaranteed user id
export interface AuthenticatedSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
}

// Handler context with parsed JSON and session
export interface HandlerContext<TBody = unknown> {
  req: NextRequest;
  session: AuthenticatedSession;
  body: TBody;
  requestId: string;
}

// Handler context for GET requests (no body)
export interface GetHandlerContext {
  req: NextRequest;
  session: AuthenticatedSession;
  searchParams: URLSearchParams;
  requestId: string;
}

// Type for route handlers
type AuthenticatedHandler<TBody = unknown> = (
  ctx: HandlerContext<TBody>
) => Promise<NextResponse>;

type AuthenticatedGetHandler = (
  ctx: GetHandlerContext
) => Promise<NextResponse>;

type PublicHandler = (
  req: NextRequest,
  requestId: string
) => Promise<NextResponse>;

/**
 * Wrap an authenticated POST/PUT/PATCH/DELETE handler with error handling
 */
export function withAuth<TBody = unknown>(
  handler: AuthenticatedHandler<TBody>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      // Check authentication
      const session = await auth();

      if (!session?.user?.id) {
        return errors.unauthorized();
      }

      // Parse JSON body safely
      let body: TBody;
      try {
        body = await req.json();
      } catch {
        return error(ErrorCodes.INVALID_JSON, "Invalid JSON in request body", 400);
      }

      // Call the handler
      return await handler({
        req,
        session: session as AuthenticatedSession,
        body,
        requestId,
      });
    } catch (err) {
      return handleError(err, requestId, req.url);
    }
  };
}

/**
 * Wrap an authenticated GET handler with error handling
 */
export function withAuthGet(handler: AuthenticatedGetHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      // Check authentication
      const session = await auth();

      if (!session?.user?.id) {
        return errors.unauthorized();
      }

      const searchParams = new URL(req.url).searchParams;

      // Call the handler
      return await handler({
        req,
        session: session as AuthenticatedSession,
        searchParams,
        requestId,
      });
    } catch (err) {
      return handleError(err, requestId, req.url);
    }
  };
}

/**
 * Wrap a public handler (no auth required) with error handling
 */
export function withPublic(handler: PublicHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      return await handler(req, requestId);
    } catch (err) {
      return handleError(err, requestId, req.url);
    }
  };
}

/**
 * Central error handler - maps all errors to proper JSON responses
 */
function handleError(
  err: unknown,
  requestId: string,
  url: string
): NextResponse<ApiErrorResponse> {
  // Extract route name from URL for logging
  const routeName = new URL(url).pathname;

  // Handle Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${requestId}] ${routeName} - Prisma error:`, err.code);
    return mapPrismaError(err);
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[${requestId}] ${routeName} - Prisma validation error`);
    return error(ErrorCodes.VALIDATION_ERROR, "Invalid data format", 400);
  }

  // Handle Prisma connection errors
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${requestId}] ${routeName} - Database connection error:`, err.message);
    return error(ErrorCodes.DB_ERROR, "Database temporarily unavailable", 503);
  }

  // Handle custom API errors (re-thrown from handlers)
  if (err instanceof ApiException) {
    return error(err.code, err.message, err.status, err.details);
  }

  // Handle unknown errors
  console.error(`[${requestId}] ${routeName} - Unhandled error:`, err);
  return errors.internal();
}

/**
 * Custom exception class for throwing API errors in handlers
 */
export class ApiException extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiException";
  }
}

// Convenience methods for throwing errors
export const throwError = {
  validation: (message: string, details?: unknown): never => {
    throw new ApiException(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  },
  notFound: (message = "Resource not found"): never => {
    throw new ApiException(ErrorCodes.NOT_FOUND, message, 404);
  },
  forbidden: (message = "Access denied"): never => {
    throw new ApiException(ErrorCodes.FORBIDDEN, message, 403);
  },
  notMember: (): never => {
    throw new ApiException(ErrorCodes.NOT_MEMBER, "You are not a member of this cohort", 403);
  },
  cohortLocked: (message?: string): never => {
    throw new ApiException(
      ErrorCodes.COHORT_LOCKED,
      message || "Trial has ended. Activate membership to continue.",
      403
    );
  },
};

/**
 * Helper to require a search param
 */
export function requireParam(
  searchParams: URLSearchParams,
  name: string
): string {
  const value = searchParams.get(name);
  if (!value) {
    throw new ApiException(ErrorCodes.MISSING_PARAM, `${name} is required`, 400);
  }
  return value;
}
