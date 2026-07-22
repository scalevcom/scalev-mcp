import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const METHODS = ["get", "post", "put", "patch", "delete"];
const BUSINESS_AUTH_SCHEMES = new Set(["bearerAuth", "apiKeyAuth", "scalevOAuth"]);
const DESTRUCTIVE_OPERATION_PATTERN = /(cancel|revoke|delete|remove|disconnect)/i;
const OAUTH_FLOW_PATHS = new Set([
  "/v3/oauth/.well-known/oauth-authorization-server",
  "/v3/oauth/authorize",
  "/v3/oauth/authorize/approve",
  "/v3/oauth/application",
  "/v3/oauth/applications/me",
  "/v3/oauth/register",
  "/v3/oauth/scopes",
  "/v3/oauth/token",
  "/v3/oauth/revoke",
  "/v3/oauth/introspect"
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourcePath = process.env.OPENAPI_PATH
  ? path.resolve(process.env.OPENAPI_PATH)
  : path.resolve(repoRoot, "..", "api-openapi", "specs", "v3", "openapi.yaml");
const outputPath = path.resolve(repoRoot, "src", "generated", "v3Catalog.ts");

const source = await readFile(sourcePath, "utf8");
const spec = parse(source);
const sourceHash = createHash("sha256").update(source).digest("hex");
const tagExternalDocs = tagExternalDocsByName(spec);
const endpoints = [];

for (const [openApiPath, pathItem] of Object.entries(spec.paths || {})) {
  if (!isAllowedPath(openApiPath)) continue;

  for (const method of METHODS) {
    const operation = pathItem?.[method];
    if (!operation || !isBusinessAuthenticated(operation, pathItem, spec)) continue;

    const parameters = [
      ...asArray(pathItem.parameters).map((parameter) => resolveRef(spec, parameter)),
      ...asArray(operation.parameters).map((parameter) => resolveRef(spec, parameter))
    ];

    endpoints.push({
      operationId: operation.operationId || fallbackOperationId(method, openApiPath),
      method: method.toUpperCase(),
      path: openApiPath,
      summary: operation.summary || fallbackSummary(method, openApiPath),
      description: cleanText(operation.description),
      externalDocs: externalDocsMetadata(operation, tagExternalDocs),
      tags: asArray(operation.tags).map(String).sort(),
      scopes: unique([...oauthScopes(operation, pathItem, spec), ...documentedScopes(operation)]).sort(),
      auth: authSchemes(operation, pathItem, spec).sort(),
      readOnly: method === "get",
      isDestructive: isDestructiveOperation(method, openApiPath, operation),
      pathParams: parametersFor(parameters, "path"),
      queryParams: parametersFor(parameters, "query"),
      requestBody: requestBodyMetadata(spec, operation.requestBody)
    });
  }
}

endpoints.sort((left, right) => {
  const pathCompare = left.path.localeCompare(right.path);
  if (pathCompare !== 0) return pathCompare;
  return methodOrder(left.method) - methodOrder(right.method);
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, generatedCatalog(sourceHash, endpoints));

console.log(`Generated ${path.relative(repoRoot, outputPath)} with ${endpoints.length} endpoints`);

function isAllowedPath(openApiPath) {
  if (!openApiPath.startsWith("/v3/")) return false;
  if (openApiPath === "/v3/me") return false;
  if (openApiPath === "/v3/me/connected_businesses") return false;
  if (OAUTH_FLOW_PATHS.has(openApiPath)) return false;
  if (openApiPath.startsWith("/v3/oauth/installation/")) return false;
  if (openApiPath.startsWith("/v3/oauth/billing/")) return false;
  if (openApiPath.startsWith("/v3/developer/oauth-billing/")) return false;
  if (isPaymentSurfacePath(openApiPath)) return false;
  if (/^\/v3\/stores\/\{[^}]+\}\/(?:public|customers)(?:\/|$)/.test(openApiPath)) return false;
  return true;
}

function isPaymentSurfacePath(openApiPath) {
  return (
    /^\/v3\/orders\/\{[^}]+\}\/(?:check-payment|check-settlement|payment)$/.test(openApiPath) ||
    /^\/v3\/orders\/pg-reference-id(?:s|\b)/.test(openApiPath) ||
    /^\/v3\/stores\/\{[^}]+\}\/payment-(?:accounts|methods)$/.test(openApiPath)
  );
}

function isBusinessAuthenticated(operation, pathItem, spec) {
  return authSchemes(operation, pathItem, spec).some((scheme) => BUSINESS_AUTH_SCHEMES.has(scheme));
}

function authSchemes(operation, pathItem, spec) {
  return unique(
    security(operation, pathItem, spec)
      .flatMap((requirement) => Object.keys(requirement || {}))
      .filter((scheme) => BUSINESS_AUTH_SCHEMES.has(scheme))
  );
}

function oauthScopes(operation, pathItem, spec) {
  return unique(
    security(operation, pathItem, spec).flatMap((requirement) => {
      const scopes = requirement?.scalevOAuth;
      return Array.isArray(scopes) ? scopes.map(String) : [];
    })
  );
}

function documentedScopes(operation) {
  const text = [operation.summary, operation.description].filter(Boolean).join(" ");
  const matches = text.matchAll(/`([a-z0-9_]+(?::[a-z0-9_]+)+)`/g);
  return [...matches].map((match) => match[1]);
}

function security(operation, pathItem, spec) {
  return operation.security || pathItem.security || spec.security || [];
}

function parametersFor(parameters, location) {
  const byName = new Map();

  for (const parameter of parameters) {
    if (parameter?.in !== location || !parameter.name) continue;

    byName.set(parameter.name, {
      name: String(parameter.name),
      in: location,
      required: Boolean(parameter.required),
      description: cleanText(parameter.description),
      schema: schemaMetadata(resolveRef(spec, parameter.schema))
    });
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function requestBodyMetadata(spec, requestBody) {
  const resolved = resolveRef(spec, requestBody);
  if (!resolved) return undefined;

  const content = resolved.content || {};
  const contentTypes = Object.keys(content).sort();
  const jsonSchema = resolveRef(spec, content["application/json"]?.schema);
  const properties = Object.keys(resolveRef(spec, jsonSchema?.properties) || {}).sort();
  const requiredFields = asArray(jsonSchema?.required).map(String).sort();
  const schemaRef = schemaRefName(content["application/json"]?.schema);

  return compact({
    required: Boolean(resolved.required),
    description: cleanText(resolved.description),
    contentTypes,
    schemaRef,
    requiredFields,
    properties
  });
}

function isDestructiveOperation(method, openApiPath, operation) {
  if (method === "delete") return true;

  return DESTRUCTIVE_OPERATION_PATTERN.test(
    [operation.operationId, openApiPath, operation.summary].filter(Boolean).join(" ")
  );
}

function tagExternalDocsByName(spec) {
  return new Map(
    asArray(spec.tags)
      .filter((tag) => tag?.name && tag?.externalDocs?.url)
      .map((tag) => [String(tag.name), externalDocsPayload(tag.externalDocs)])
  );
}

function externalDocsMetadata(operation, tagExternalDocs) {
  const operationDocs = externalDocsPayload(operation.externalDocs);
  if (operationDocs) return operationDocs;

  for (const tagName of asArray(operation.tags).map(String)) {
    const tagDocs = tagExternalDocs.get(tagName);
    if (tagDocs) return tagDocs;
  }

  return undefined;
}

function externalDocsPayload(externalDocs) {
  const url = cleanText(externalDocs?.url);
  if (!url) return undefined;

  return compact({
    url,
    description: cleanText(externalDocs.description)
  });
}

function schemaMetadata(schema) {
  if (!schema) return undefined;

  const metadata = compact({
    type: schema.type,
    format: schema.format,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    itemsType: schema.items?.type,
    pattern: schema.pattern,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum
  });

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function resolveRef(spec, value) {
  if (!value || typeof value !== "object" || !value.$ref) return value;

  const parts = String(value.$ref).replace(/^#\//, "").split("/");
  return parts.reduce((cursor, part) => cursor?.[part], spec);
}

function schemaRefName(schema) {
  const ref = schema?.$ref;
  if (!ref) return undefined;
  return String(ref).split("/").pop();
}

function fallbackOperationId(method, openApiPath) {
  const suffix = openApiPath
    .replace(/^\/v3\//, "")
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return `${method}_${suffix}`;
}

function fallbackSummary(method, openApiPath) {
  return `${method.toUpperCase()} ${openApiPath}`;
}

function methodOrder(method) {
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].indexOf(method);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim() || undefined;
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => typeof value !== "undefined"));
}

function generatedCatalog(sourceHash, endpoints) {
  return `// Generated by scripts/generate-v3-catalog.mjs from ../api-openapi/specs/v3/openapi.yaml.
// Do not edit by hand.

import type { V3Endpoint } from "../catalog";

export const V3_CATALOG_SOURCE_SHA256 = ${JSON.stringify(sourceHash)};

export const V3_ENDPOINTS = ${JSON.stringify(endpoints, null, 2)} as const satisfies readonly V3Endpoint[];
`;
}
