import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const WORKSPACE = resolve(ROOT, "..");

const requiredFiles = [
  {
    repo: "nexus",
    path: "lib/scalev_api_web/controllers/security_txt_controller.ex",
    snippets: ["Contact:", "Policy:", "Canonical:", "Expires:"]
  },
  {
    repo: "nexus",
    path: "lib/util/reviewer_seed_audit.ex",
    snippets: [
      "Util.ReviewerSeedAudit",
      "Claude connector review seed",
      "business_unique_id",
      "awb_cancel_order"
    ]
  },
  {
    repo: "nexus",
    path: "lib/scalev_api_web/router.ex",
    snippets: [
      "get \"/me/connected_businesses\"",
      "get \"/scopes\"",
      "get \"/applications/me\""
    ]
  },
  {
    repo: "nexus",
    path: "docs/oauth_apps_developer_guide.md",
    snippets: [
      "## MCP Clients",
      "dynamic client registration",
      "CIMD",
      "business_unique_id",
      "refresh token TTL is 30 days",
      "re-adding the connector requires a fresh OAuth approval"
    ]
  },
  {
    repo: "api-openapi",
    path: "specs/v3/openapi.yaml",
    snippets: [
      "/v3/me/connected_businesses:",
      "/v3/oauth/scopes:",
      "/v3/oauth/applications/me:",
      "connected_businesses"
    ]
  },
  {
    repo: "scalev-fe-app",
    path: "pages/oauth/authorize.vue",
    snippets: [
      "authorizableBusinesses",
      "selectedBusinessUniqueIds",
      "scopeGroupLabel",
      "businessUniqueIds"
    ]
  },
  {
    repo: "scalev-fe-app",
    path: "pages/setting/apps/index.vue",
    snippets: [
      "No connected apps",
      "last_activity_at",
      "revokeAccess",
      "app_logo_url"
    ]
  },
  {
    repo: "docs",
    path: "en/scalev-mcp-connector.mdx",
    snippets: [
      "Scalev MCP exposes 25 tools",
      "https://mcp.scalev.com/mcp",
      "business_unique_id",
      "Claude supports remote MCP servers"
    ]
  },
  {
    repo: "docs",
    path: "id/konektor-scalev-mcp.mdx",
    snippets: [
      "Scalev MCP menyediakan 25 tool",
      "https://mcp.scalev.com/mcp",
      "business_unique_id",
      "Claude mendukung remote MCP server"
    ]
  }
];

const errors = [];

for (const entry of requiredFiles) {
  const fullPath = resolve(WORKSPACE, entry.repo, entry.path);

  if (!existsSync(fullPath)) {
    errors.push(`missing ${entry.repo}/${entry.path}`);
    continue;
  }

  const text = readFileSync(fullPath, "utf8");
  for (const snippet of entry.snippets) {
    if (!text.includes(snippet)) {
      errors.push(`${entry.repo}/${entry.path} missing snippet: ${snippet}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Submission workspace check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Submission workspace check passed (${requiredFiles.length} cross-repo files).`);
