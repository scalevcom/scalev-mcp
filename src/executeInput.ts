import { normalizeBusinessSelectorInput, type BusinessScopedToolInput } from "./businessSelector";

const RESERVED_EXECUTE_INPUT_KEYS = new Set([
  "operation_id",
  "path",
  "business_unique_id",
  "path_params",
  "query",
  "query_params",
  "query_parameters",
  "header_params",
  "headers",
  "body"
]);

export type ExecuteToolInput = BusinessScopedToolInput;

export function normalizeExecuteInput(input: ExecuteToolInput): BusinessScopedToolInput {
  input = normalizeBusinessSelectorInput(input);

  if (typeof input.body !== "undefined") {
    return { ...baseExecuteInput(input), body: normalizeJsonLikeBody(input.body) };
  }

  const extraBody = collectExtraBodyFields(input);

  if (Object.keys(extraBody).length === 0) {
    return baseExecuteInput(input);
  }

  return {
    ...baseExecuteInput(input),
    body: extraBody
  };
}

function baseExecuteInput(input: ExecuteToolInput): BusinessScopedToolInput {
  const base: BusinessScopedToolInput = {
    operation_id: input.operation_id,
    path: input.path,
    path_params: input.path_params,
    query: input.query
  };

  if (input.business_unique_id) {
    base.business_unique_id = input.business_unique_id;
  }

  return base;
}

function collectExtraBodyFields(input: ExecuteToolInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!RESERVED_EXECUTE_INPUT_KEYS.has(key) && typeof value !== "undefined") {
      body[key] = value;
    }
  }

  return body;
}

function normalizeJsonLikeBody(body: unknown): unknown {
  if (typeof body !== "string") return body;

  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return body;

  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}
