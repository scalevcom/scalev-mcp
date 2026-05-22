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
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
  }
}

export function nexusUrl(env: Pick<Env, "NEXUS_API_BASE_URL">, path: string): URL {
  if (!path.startsWith("/v3/")) {
    throw new Error(`Nexus calls must use /v3 paths: ${path}`);
  }

  const base = env.NEXUS_API_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}${path}`);

  if (url.pathname.includes("/v2/") || url.href.includes("/v2/")) {
    throw new Error(`Nexus MCP calls must never use /v2: ${url.href}`);
  }

  return url;
}

export function nexusBusinessUrl(env: Pick<Env, "NEXUS_API_BASE_URL">, path: string): URL {
  const url = nexusUrl(env, path);
  const pathname = url.pathname;

  if (isOAuthFlowPath(pathname)) {
    throw new Error(`Nexus OAuth flow routes are not exposed through execute: ${pathname}`);
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
    throw new Error(`Unsupported Nexus v3 method: ${request.method}`);
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
  const apiError = payloadString(payload, "error");

  if (apiErrorCode === "business_selection_required") {
    return `Nexus business_selection_required${requestIdPart}: ${apiError || "business_unique_id is required"}`;
  }

  const detail =
    typeof payload !== "undefined" ? JSON.stringify(payload) : text ? text : "empty response body";

  return `Nexus request failed with ${response.status}${requestIdPart}: ${detail}`;
}

function payloadString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
