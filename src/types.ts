export interface Env {
  NEXUS_API_BASE_URL: string;
  NEXUS_OAUTH_ISSUER: string;
  MCP_RESOURCE_URI: string;
  ALLOWED_ORIGINS?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

export interface AuthContext {
  token: string;
  requestId?: string;
}
