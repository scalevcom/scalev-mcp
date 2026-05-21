export interface Env {
  NEXUS_API_BASE_URL: string;
  NEXUS_OAUTH_ISSUER: string;
  MCP_RESOURCE_URI: string;
}

export interface AuthContext {
  token: string;
}
