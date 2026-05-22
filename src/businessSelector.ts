import type { CatalogQueryValue, CatalogRequestInput } from "./catalog";

const BUSINESS_SELECTOR_KEY = "business_unique_id";
const QUERY_ALIAS_KEYS = ["query_params", "query_parameters"];
const HEADER_ALIAS_KEYS = ["header_params", "headers"];

export type BusinessScopedToolInput = CatalogRequestInput & Record<string, unknown>;

export function normalizeBusinessSelectorInput(input: BusinessScopedToolInput): BusinessScopedToolInput {
  const normalized: BusinessScopedToolInput = { ...input };
  let businessUniqueId: string | undefined;

  businessUniqueId = mergeBusinessSelector(businessUniqueId, input.business_unique_id, "business_unique_id");

  if (typeof input.path === "string") {
    const sanitizedPath = stripBusinessSelectorFromPath(input.path, businessUniqueId);
    normalized.path = sanitizedPath.path;
    businessUniqueId = sanitizedPath.businessUniqueId;
  }

  const normalizedQuery = normalizeQueryInputs(input, businessUniqueId);
  businessUniqueId = normalizedQuery.businessUniqueId;

  if (Object.keys(normalizedQuery.query).length > 0) {
    normalized.query = normalizedQuery.query;
  } else {
    delete normalized.query;
  }

  for (const key of QUERY_ALIAS_KEYS) delete normalized[key];

  for (const key of HEADER_ALIAS_KEYS) {
    const value = input[key];
    if (isRecord(value)) {
      businessUniqueId = mergeBusinessSelector(businessUniqueId, value[BUSINESS_SELECTOR_KEY], key);
    }

    delete normalized[key];
  }

  if (typeof input.body !== "undefined") {
    const sanitizedBody = stripBusinessSelectorFromBody(input.body, businessUniqueId);
    businessUniqueId = sanitizedBody.businessUniqueId;

    if (typeof sanitizedBody.body === "undefined") {
      delete normalized.body;
    } else {
      normalized.body = sanitizedBody.body;
    }
  }

  if (businessUniqueId) {
    normalized.business_unique_id = businessUniqueId;
  } else {
    delete normalized.business_unique_id;
  }

  return normalized;
}

function normalizeQueryInputs(
  input: BusinessScopedToolInput,
  initialBusinessUniqueId: string | undefined
): { query: Record<string, CatalogQueryValue>; businessUniqueId: string | undefined } {
  let businessUniqueId = initialBusinessUniqueId;
  const query: Record<string, CatalogQueryValue> = {};

  for (const key of QUERY_ALIAS_KEYS) {
    const sanitized = stripBusinessSelectorFromQuery(input[key], businessUniqueId, key);
    businessUniqueId = sanitized.businessUniqueId;
    Object.assign(query, sanitized.query);
  }

  const sanitizedQuery = stripBusinessSelectorFromQuery(input.query, businessUniqueId, "query");
  businessUniqueId = sanitizedQuery.businessUniqueId;
  Object.assign(query, sanitizedQuery.query);

  return { query, businessUniqueId };
}

function stripBusinessSelectorFromQuery(
  value: unknown,
  initialBusinessUniqueId: string | undefined,
  location: string
): { query: Record<string, CatalogQueryValue>; businessUniqueId: string | undefined } {
  let businessUniqueId = initialBusinessUniqueId;
  const query: Record<string, CatalogQueryValue> = {};

  if (!isRecord(value)) return { query, businessUniqueId };

  for (const [key, queryValue] of Object.entries(value)) {
    if (key === BUSINESS_SELECTOR_KEY) {
      businessUniqueId = mergeBusinessSelector(businessUniqueId, queryValue, location);
    } else {
      query[key] = queryValue as CatalogQueryValue;
    }
  }

  return { query, businessUniqueId };
}

function stripBusinessSelectorFromBody(
  value: unknown,
  initialBusinessUniqueId: string | undefined
): { body: unknown; businessUniqueId: string | undefined } {
  const parsedValue = parseJsonObjectString(value);

  if (!isRecord(parsedValue)) return { body: value, businessUniqueId: initialBusinessUniqueId };

  let businessUniqueId = initialBusinessUniqueId;
  const body: Record<string, unknown> = {};

  for (const [key, bodyValue] of Object.entries(parsedValue)) {
    if (key === BUSINESS_SELECTOR_KEY) {
      businessUniqueId = mergeBusinessSelector(businessUniqueId, bodyValue, "body");
    } else {
      body[key] = bodyValue;
    }
  }

  return {
    body: Object.keys(body).length > 0 ? body : undefined,
    businessUniqueId
  };
}

function stripBusinessSelectorFromPath(
  path: string,
  initialBusinessUniqueId: string | undefined
): { path: string; businessUniqueId: string | undefined } {
  const queryIndex = path.indexOf("?");
  if (queryIndex < 0) return { path, businessUniqueId: initialBusinessUniqueId };

  const pathname = path.slice(0, queryIndex);
  const params = new URLSearchParams(path.slice(queryIndex + 1));
  let businessUniqueId = initialBusinessUniqueId;

  for (const value of params.getAll(BUSINESS_SELECTOR_KEY)) {
    businessUniqueId = mergeBusinessSelector(businessUniqueId, value, "path query");
  }

  params.delete(BUSINESS_SELECTOR_KEY);
  const queryString = params.toString();

  return {
    path: queryString ? `${pathname}?${queryString}` : pathname,
    businessUniqueId
  };
}

function parseJsonObjectString(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function mergeBusinessSelector(
  current: string | undefined,
  rawValue: unknown,
  location: string
): string | undefined {
  const values = selectorValues(rawValue);
  let selected = current;

  for (const value of values) {
    if (!selected) {
      selected = value;
    } else if (selected !== value) {
      throw new Error(
        `Conflicting business_unique_id values in MCP input at ${location}: ${selected} and ${value}. Use one selected connected_businesses[].unique_id.`
      );
    }
  }

  return selected;
}

function selectorValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(selectorValues);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
