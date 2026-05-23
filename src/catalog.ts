import { V3_CATALOG_SOURCE_SHA256, V3_ENDPOINTS } from "./generated/v3Catalog";
import { docsTopicForUrl } from "./docs";
import { normalizeBusinessSelectorInput, type BusinessScopedToolInput } from "./businessSelector";
import type { BusinessV3Method, BusinessV3Request } from "./nexusClient";

export type CatalogPrimitive = string | number | boolean;
export type CatalogQueryValue = CatalogPrimitive | CatalogPrimitive[] | null;

export interface V3EndpointParameter {
  readonly name: string;
  readonly in: "path" | "query";
  readonly required: boolean;
  readonly description?: string;
  readonly schema?: {
    readonly type?: string;
    readonly format?: string;
    readonly enum?: readonly string[];
    readonly itemsType?: string;
  };
}

export interface V3EndpointRequestBody {
  readonly required: boolean;
  readonly description?: string;
  readonly contentTypes: readonly string[];
  readonly schemaRef?: string;
  readonly requiredFields: readonly string[];
  readonly properties: readonly string[];
}

export interface V3EndpointExternalDocs {
  readonly url: string;
  readonly description?: string;
}

export interface V3Endpoint {
  readonly operationId: string;
  readonly method: BusinessV3Method;
  readonly path: string;
  readonly summary: string;
  readonly description?: string;
  readonly externalDocs?: V3EndpointExternalDocs;
  readonly tags: readonly string[];
  readonly scopes: readonly string[];
  readonly auth: readonly string[];
  readonly readOnly: boolean;
  readonly isDestructive: boolean;
  readonly pathParams: readonly V3EndpointParameter[];
  readonly queryParams: readonly V3EndpointParameter[];
  readonly requestBody?: V3EndpointRequestBody;
}

export type EndpointExecutionTool = "get" | "execute_safe" | "execute_destructive";

export interface EndpointSearchInput {
  query?: string;
  tag?: string;
  method?: BusinessV3Method;
  scope?: string;
  read_only?: boolean;
  limit?: number;
}

export interface EndpointSearchResult {
  operation_id: string;
  method: BusinessV3Method;
  execution_tool: EndpointExecutionTool;
  path_template: string;
  summary: string;
  description?: string;
  docs_url?: string;
  docs_topic?: string;
  docs_hint?: string;
  tags: string[];
  scopes: string[];
  read_only: boolean;
  is_destructive: boolean;
  path_params: V3EndpointParameter[];
  query_params: V3EndpointParameter[];
  request_body?: V3EndpointRequestBody;
  call: {
    operation_id: string;
    required_path_params: string[];
    optional_query_params: string[];
    body_required: boolean;
  };
}

export interface EndpointSearchResponse {
  data: EndpointSearchResult[];
  total_matches: number;
  is_paginated: false;
  catalog: {
    source: string;
    source_sha256: string;
    endpoint_count: number;
  };
}

export interface CatalogRequestInput {
  operation_id?: string;
  path?: string;
  business_unique_id?: string;
  path_params?: Record<string, CatalogPrimitive>;
  query?: Record<string, CatalogQueryValue>;
  body?: unknown;
}

export interface ResolvedEndpointRequest {
  endpoint: V3Endpoint;
  request: BusinessV3Request;
}

const CATALOG_SOURCE = "../api-openapi/specs/v3/openapi.yaml";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ENDPOINTS_BY_OPERATION_ID = new Map<string, V3Endpoint>(
  V3_ENDPOINTS.map((endpoint) => [endpoint.operationId, endpoint])
);

export function catalogEndpointCount(): number {
  return V3_ENDPOINTS.length;
}

export function searchEndpoints(input: EndpointSearchInput = {}): EndpointSearchResponse {
  const queryTerms = terms(input.query);
  const tag = normalize(input.tag);
  const scope = normalize(input.scope);
  const limit = clampLimit(input.limit);

  const matches = V3_ENDPOINTS.map((endpoint) => ({ endpoint, score: scoreEndpoint(endpoint, queryTerms) }))
    .filter(({ endpoint, score }) => {
      if (queryTerms.length > 0 && score <= 0) return false;
      if (input.method && endpoint.method !== input.method) return false;
      if (typeof input.read_only === "boolean" && endpoint.readOnly !== input.read_only) return false;
      if (tag && !endpoint.tags.some((endpointTag) => normalize(endpointTag) === tag)) return false;
      if (scope && !endpoint.scopes.some((endpointScope) => normalize(endpointScope) === scope)) return false;
      return true;
    })
    .sort((left, right) => compareScoredEndpoints(left, right));

  return {
    data: matches.slice(0, limit).map(({ endpoint }) => endpointSearchResult(endpoint)),
    total_matches: matches.length,
    is_paginated: false,
    catalog: {
      source: CATALOG_SOURCE,
      source_sha256: V3_CATALOG_SOURCE_SHA256,
      endpoint_count: V3_ENDPOINTS.length
    }
  };
}

export function buildGetRequest(input: BusinessScopedToolInput): ResolvedEndpointRequest {
  input = normalizeBusinessSelectorInput(input);
  const resolved = resolveEndpoint(input, ["GET"], "get");

  if (typeof input.body !== "undefined") {
    throw new Error("get does not accept a request body");
  }

  const path = withQuery(resolved.endpoint, resolved.path, resolved.queryParams, input.query);

  return {
    endpoint: resolved.endpoint,
    request: {
      method: resolved.endpoint.method,
      path,
      ...businessSelector(input)
    }
  };
}

export function buildExecuteSafeRequest(input: BusinessScopedToolInput): ResolvedEndpointRequest {
  return buildExecuteRequest(input, false, "execute_safe");
}

export function buildExecuteDestructiveRequest(input: BusinessScopedToolInput): ResolvedEndpointRequest {
  return buildExecuteRequest(input, true, "execute_destructive");
}

function buildExecuteRequest(
  input: BusinessScopedToolInput,
  destructive: boolean,
  toolName: "execute_safe" | "execute_destructive"
): ResolvedEndpointRequest {
  input = normalizeBusinessSelectorInput(input);
  const resolved = resolveEndpoint(input, ["POST", "PUT", "PATCH", "DELETE"], toolName);

  if (resolved.endpoint.isDestructive !== destructive) {
    const expectedTool = resolved.endpoint.isDestructive ? "execute_destructive" : "execute_safe";
    throw new Error(`${toolName} cannot run ${resolved.endpoint.operationId}; use ${expectedTool}`);
  }

  const path = withQuery(resolved.endpoint, resolved.path, resolved.queryParams, input.query);

  return {
    endpoint: resolved.endpoint,
    request: {
      method: resolved.endpoint.method,
      path,
      ...businessSelector(input),
      body: input.body
    }
  };
}

function businessSelector(input: CatalogRequestInput): Pick<BusinessV3Request, "businessUniqueId"> {
  return input.business_unique_id ? { businessUniqueId: input.business_unique_id } : {};
}

function resolveEndpoint(
  input: CatalogRequestInput,
  allowedMethods: readonly BusinessV3Method[],
  toolName: EndpointExecutionTool
): {
  endpoint: V3Endpoint;
  path: string;
  queryParams: URLSearchParams;
} {
  if (input.operation_id) {
    const endpoint = ENDPOINTS_BY_OPERATION_ID.get(input.operation_id);
    if (!endpoint) throw new Error(`Unknown v3 operation_id: ${input.operation_id}`);
    if (!allowedMethods.includes(endpoint.method)) {
      throw new Error(`${toolName} cannot run ${endpoint.method} operation ${endpoint.operationId}`);
    }

    return {
      endpoint,
      path: buildPathFromTemplate(endpoint, input.path_params),
      queryParams: new URLSearchParams()
    };
  }

  if (!input.path) {
    throw new Error(`${toolName} requires either operation_id or path`);
  }

  const parsed = parseInputPath(input.path, toolName);
  const endpoints = parsed.pathname.includes("{")
    ? findTemplateEndpoints(allowedMethods, parsed.pathname)
    : findConcreteEndpoints(allowedMethods, parsed.pathname);

  if (endpoints.length === 0) {
    throw new Error(`No ${toolName}-compatible business-authenticated v3 catalog operation matches ${parsed.pathname}`);
  }

  if (endpoints.length > 1) {
    const candidates = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.operationId}`).join(", ");
    throw new Error(`Ambiguous ${toolName} path ${parsed.pathname}. Use operation_id. Candidates: ${candidates}`);
  }

  const endpoint = endpoints[0];

  return {
    endpoint,
    path: parsed.pathname.includes("{") ? buildPathFromTemplate(endpoint, input.path_params) : parsed.pathname,
    queryParams: parsed.searchParams
  };
}

function findTemplateEndpoints(methods: readonly BusinessV3Method[], path: string): V3Endpoint[] {
  return V3_ENDPOINTS.filter((endpoint) => methods.includes(endpoint.method) && endpoint.path === path);
}

function findConcreteEndpoints(methods: readonly BusinessV3Method[], path: string): V3Endpoint[] {
  const exact = V3_ENDPOINTS.filter((endpoint) => methods.includes(endpoint.method) && endpoint.path === path);
  if (exact.length > 0) return exact;

  return V3_ENDPOINTS.filter((endpoint) => methods.includes(endpoint.method) && pathMatcher(endpoint.path).test(path));
}

function buildPathFromTemplate(
  endpoint: V3Endpoint,
  pathParams: Record<string, CatalogPrimitive> | undefined
): string {
  for (const param of endpoint.pathParams) {
    if (param.required && typeof pathParams?.[param.name] === "undefined") {
      throw new Error(`Missing required path parameter for ${endpoint.operationId}: ${param.name}`);
    }
  }

  return endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = pathParams?.[name];
    if (typeof value === "undefined") {
      throw new Error(`Missing required path parameter for ${endpoint.operationId}: ${name}`);
    }

    return encodeURIComponent(String(value));
  });
}

function withQuery(
  endpoint: V3Endpoint,
  path: string,
  queryParams: URLSearchParams,
  query: Record<string, CatalogQueryValue> | undefined
): string {
  const params = new URLSearchParams(queryParams);

  for (const [key, value] of Object.entries(query || {})) {
    params.delete(key);
    if (value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }

  for (const param of endpoint.queryParams) {
    if (param.required && !params.has(param.name)) {
      throw new Error(`Missing required query parameter for ${endpoint.operationId}: ${param.name}`);
    }
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function parseInputPath(
  path: string,
  toolName: EndpointExecutionTool
): { pathname: string; searchParams: URLSearchParams } {
  if (!path.startsWith("/v3/")) throw new Error(`${toolName} only supports /v3 paths: ${path}`);

  const url = new URL(path, "https://nexus.local");
  return { pathname: url.pathname, searchParams: url.searchParams };
}

function endpointSearchResult(endpoint: V3Endpoint): EndpointSearchResult {
  const docsUrl = endpoint.externalDocs?.url;
  const executionTool =
    endpoint.method === "GET" ? "get" : endpoint.isDestructive ? "execute_destructive" : "execute_safe";

  return {
    operation_id: endpoint.operationId,
    method: endpoint.method,
    execution_tool: executionTool,
    path_template: endpoint.path,
    summary: endpoint.summary,
    description: endpoint.description,
    docs_url: docsUrl,
    docs_topic: docsUrl ? docsTopicForUrl(docsUrl) : undefined,
    docs_hint: endpoint.externalDocs?.description,
    tags: [...endpoint.tags],
    scopes: [...endpoint.scopes],
    read_only: endpoint.readOnly,
    is_destructive: endpoint.isDestructive,
    path_params: [...endpoint.pathParams],
    query_params: [...endpoint.queryParams],
    request_body: endpoint.requestBody,
    call: {
      operation_id: endpoint.operationId,
      required_path_params: endpoint.pathParams.filter((param) => param.required).map((param) => param.name),
      optional_query_params: endpoint.queryParams.filter((param) => !param.required).map((param) => param.name),
      body_required: Boolean(endpoint.requestBody?.required)
    }
  };
}

function scoreEndpoint(endpoint: V3Endpoint, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 1;

  let score = 0;
  const operationId = normalize(endpoint.operationId);
  const path = normalize(endpoint.path);
  const summary = normalize(endpoint.summary);
  const description = normalize(endpoint.description);
  const tags = endpoint.tags.map(normalize);
  const scopes = endpoint.scopes.map(normalize);

  for (const term of queryTerms) {
    let termScore = 0;
    if (operationId === term) termScore += 40;
    if (operationId.includes(term)) termScore += 20;
    if (path.includes(term)) termScore += 18;
    if (tags.some((tag) => tag === term || tag.includes(term))) termScore += 14;
    if (summary.includes(term)) termScore += 10;
    if (scopes.some((scope) => scope === term || scope.includes(term))) termScore += 8;
    if (description.includes(term)) termScore += 3;
    if (termScore === 0) return 0;
    score += termScore;
  }

  return score;
}

function compareScoredEndpoints(
  left: { endpoint: V3Endpoint; score: number },
  right: { endpoint: V3Endpoint; score: number }
): number {
  if (right.score !== left.score) return right.score - left.score;
  if (left.endpoint.readOnly !== right.endpoint.readOnly) return left.endpoint.readOnly ? -1 : 1;
  const tagCompare = (left.endpoint.tags[0] || "").localeCompare(right.endpoint.tags[0] || "");
  if (tagCompare !== 0) return tagCompare;
  const pathCompare = left.endpoint.path.localeCompare(right.endpoint.path);
  if (pathCompare !== 0) return pathCompare;
  return left.endpoint.method.localeCompare(right.endpoint.method);
}

function pathMatcher(template: string): RegExp {
  const params = /\{([^}]+)\}/g;
  let pattern = "^";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = params.exec(template))) {
    pattern += escapeRegex(template.slice(cursor, match.index));
    pattern += "[^/]+";
    cursor = match.index + match[0].length;
  }

  pattern += escapeRegex(template.slice(cursor));
  pattern += "$";

  return new RegExp(pattern);
}

function terms(query: string | undefined): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean);
}

function normalize(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function clampLimit(limit: number | undefined): number {
  if (!limit) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
