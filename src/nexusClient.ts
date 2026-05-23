import type { AuthContext, Env } from "./types";

const BUSINESS_V3_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type BusinessV3Method = (typeof BUSINESS_V3_METHODS)[number];

export interface BusinessV3Request {
  method: BusinessV3Method;
  path: string;
  businessUniqueId?: string;
  body?: unknown;
}

export class NexusError extends Error {
  public readonly errorCode?: string;

  constructor(
    message: string,
    public readonly status: number,
    payload?: unknown
  ) {
    super(message);
    this.errorCode = payloadString(payload, "error_code");
  }
}

export function nexusErrorCode(error: unknown): string | undefined {
  if (!(error instanceof NexusError)) return undefined;
  return error.errorCode;
}

export function nexusUrl(env: Pick<Env, "NEXUS_API_BASE_URL">, path: string): URL {
  if (!path.startsWith("/v3/")) {
    throw new Error(`Scalev API calls must use /v3 paths: ${path}`);
  }

  const base = env.NEXUS_API_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}${path}`);

  if (url.pathname.includes("/v2/") || url.href.includes("/v2/")) {
    throw new Error(`Scalev MCP calls must never use /v2: ${url.href}`);
  }

  return url;
}

export function nexusBusinessUrl(env: Pick<Env, "NEXUS_API_BASE_URL">, path: string): URL {
  const url = nexusUrl(env, path);
  const pathname = url.pathname;

  if (isOAuthFlowPath(pathname)) {
    throw new Error(`Scalev OAuth flow routes are not exposed through execute: ${pathname}`);
  }

  if (isOAuthBillingPath(pathname)) {
    throw new Error(`Scalev OAuth billing routes are not exposed through execute: ${pathname}`);
  }

  if (isPaymentSurfacePath(pathname)) {
    throw new Error(`Scalev payment routes are not exposed through execute: ${pathname}`);
  }

  if (isStorefrontClientPath(pathname)) {
    throw new Error(`Storefront public and customer routes are not business-authenticated v3 routes: ${pathname}`);
  }

  return url;
}

export async function nexusBusinessRequest<T>(
  env: Env,
  auth: AuthContext,
  request: BusinessV3Request
): Promise<T> {
  const method = request.method.toUpperCase() as BusinessV3Method;

  if (!BUSINESS_V3_METHODS.includes(method)) {
    throw new Error(`Unsupported Scalev API method: ${request.method}`);
  }

  if (method === "GET" && typeof request.body !== "undefined") {
    throw new Error("GET requests must not include a body");
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${auth.token}`
  };

  const init: RequestInit = { method, headers };

  if (typeof request.body !== "undefined") {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(request.body);
  }

  const url = nexusBusinessUrl(env, request.path);

  if (request.businessUniqueId) {
    url.searchParams.set("b_uid", request.businessUniqueId);
  }

  const response = await fetch(url, init);
  return parseJsonResponse<T>(response);
}

function isOAuthFlowPath(pathname: string): boolean {
  return (
    pathname === "/v3/oauth/.well-known/oauth-authorization-server" ||
    pathname === "/v3/oauth/authorize" ||
    pathname === "/v3/oauth/authorize/approve" ||
    pathname === "/v3/oauth/application" ||
    pathname === "/v3/oauth/register" ||
    pathname === "/v3/oauth/token" ||
    pathname === "/v3/oauth/revoke" ||
    pathname === "/v3/oauth/introspect" ||
    pathname.startsWith("/v3/oauth/installation/")
  );
}

function isOAuthBillingPath(pathname: string): boolean {
  return pathname.startsWith("/v3/oauth/billing/") || pathname.startsWith("/v3/developer/oauth-billing/");
}

function isPaymentSurfacePath(pathname: string): boolean {
  return (
    /^\/v3\/orders\/[^/]+\/(?:check-payment|check-settlement|payment)$/.test(pathname) ||
    /^\/v3\/orders\/pg-reference-id(?:s|\b)/.test(pathname) ||
    /^\/v3\/stores\/[^/]+\/payment-(?:accounts|methods)$/.test(pathname)
  );
}

function isStorefrontClientPath(pathname: string): boolean {
  return /^\/v3\/stores\/[^/]+\/(?:public|customers)(?:\/|$)/.test(pathname);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text().catch(() => "");
  const payload = parseJson(text);

  if (!response.ok) {
    throw new NexusError(errorMessage(response, payload, text), response.status, payload);
  }

  return payload as T;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function errorMessage(response: Response, payload: unknown, text: string): string {
  const requestId = response.headers.get("x-request-id");
  const requestIdPart = requestId ? ` (request_id: ${requestId})` : "";
  const apiErrorCode = payloadString(payload, "error_code");
  const codePart = apiErrorCode ? ` ${apiErrorCode}` : "";

  if (apiErrorCode === "business_selection_required") {
    return [
      `Scalev API business_selection_required${requestIdPart}:`,
      "choose one business from get_me.connected_businesses and pass its unique_id as top-level business_unique_id."
    ].join(" ");
  }

  if (apiErrorCode === "business_not_found" || apiErrorCode === "business_access_denied") {
    return [
      `Scalev API${codePart}${requestIdPart}:`,
      "the selected business_unique_id is not connected to this OAuth token or is no longer active."
    ].join(" ");
  }

  if (response.status === 401) {
    return [
      `Scalev API authentication failed${codePart}${requestIdPart}:`,
      "the OAuth token is missing, expired, revoked, or not accepted for this connector. Reconnect Scalev in Claude and retry."
    ].join(" ");
  }

  if (response.status === 403) {
    return [
      `Scalev API authorization failed${codePart}${requestIdPart}:`,
      "the OAuth token, selected business, or approved scopes do not allow this action. Use get_me to inspect connected businesses and scopes, then reconnect if a scope is missing."
    ].join(" ");
  }

  if (response.status === 404) {
    return [
      `Scalev API resource not found${codePart}${requestIdPart}:`,
      "the requested Scalev resource does not exist or is not visible to the selected business."
    ].join(" ");
  }

  if (response.status === 409) {
    return [
      `Scalev API state conflict${codePart}${requestIdPart}:`,
      "refresh the resource, confirm the latest state, and retry only if the requested change still applies."
    ].join(" ");
  }

  if (response.status === 429) {
    return [
      `Scalev API rate limit reached${codePart}${requestIdPart}:`,
      "wait before retrying this Scalev action."
    ].join(" ");
  }

  if (response.status === 400 || response.status === 422) {
    const validationDetails = validationErrorDetails(payload);

    return [
      `Scalev API rejected the request${codePart}${requestIdPart}:`,
      validationDetails ??
        "check operation_id, path_params, query, and body against search metadata and get_docs before retrying."
    ].join(" ");
  }

  if (response.status >= 500) {
    return [
      `Scalev API service error${codePart}${requestIdPart}:`,
      "Scalev could not complete the request. Retry later or contact Scalev support with the request_id."
    ].join(" ");
  }

  if (!text && typeof payload === "undefined") {
    return `Scalev API request failed with ${response.status}${codePart}${requestIdPart}: empty response body`;
  }

  return [
    `Scalev API request failed with ${response.status}${codePart}${requestIdPart}:`,
    "Scalev returned an error that was not exposed to Claude to avoid leaking business or customer data."
  ].join(" ");
}

function payloadString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function validationErrorDetails(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

  const errors = (payload as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return undefined;

  const details = Object.entries(errors)
    .flatMap(([field, value]) => {
      const safeField = safeValidationField(field);
      if (!safeField) return [];

      const messages = validationMessages(value)
        .map(safeValidationMessage)
        .filter((message): message is string => Boolean(message));

      if (messages.length === 0) {
        return [`${safeField}: invalid`];
      }

      return [`${safeField}: ${messages.slice(0, 2).join("; ")}`];
    })
    .slice(0, 4);

  if (details.length === 0) return undefined;

  return `Validation failed. ${details.join("; ")}.`;
}

function safeValidationField(field: string): string | undefined {
  const normalized = field.replace(/[^\w.[\]-]/g, "").slice(0, 80);
  return normalized || undefined;
}

function validationMessages(value: unknown): string[] {
  if (typeof value === "string") return [value];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function safeValidationMessage(message: string): string | undefined {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  const redacted = normalized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(^|[^\w.])((?:\+?62|0)\d(?:[\s().-]*\d){7,14})(?=$|[^\w.])/g, "$1[number]")
    .replace(/\b(?:CR|ORD)[A-Z0-9-]{4,}\b/g, "[id]");

  return truncateValidationMessage(redacted);
}

function truncateValidationMessage(message: string): string {
  return message.length <= 400 ? message : `${message.slice(0, 397)}...`;
}
