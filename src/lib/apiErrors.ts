import { NextResponse } from "next/server";

type ErrorWithCode = Error & { code?: string; cause?: unknown };

function hasErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as ErrorWithCode;
  if (maybeError.code === code) return true;
  return hasErrorCode(maybeError.cause, code);
}

function messageIncludes(error: unknown, value: string): boolean {
  if (!error) return false;
  if (error instanceof Error && error.message.includes(value)) return true;
  if (typeof error === "object" && "cause" in error) return messageIncludes((error as ErrorWithCode).cause, value);
  return false;
}

export function hasPrismaCode(error: unknown, code: string) {
  return hasErrorCode(error, code);
}

export function apiError(error: unknown) {
  if (hasErrorCode(error, "EAI_AGAIN") || hasErrorCode(error, "ENOTFOUND") || messageIncludes(error, "getaddrinfo")) {
    return NextResponse.json(
      {
        error:
          "Database host could not be resolved. Check your network/DNS connection and DATABASE_URL host, then retry.",
        code: "DATABASE_DNS_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  if (hasErrorCode(error, "ECONNREFUSED") || hasErrorCode(error, "ETIMEDOUT")) {
    return NextResponse.json(
      {
        error: "Database connection is unavailable. Check DATABASE_URL and database availability, then retry.",
        code: "DATABASE_CONNECTION_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
