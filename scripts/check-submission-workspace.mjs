import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const WORKSPACE = resolve(ROOT, "..");
const API_LABEL = "Scalev API";
const API_MARKER = "lib/scalev_api_web/router.ex";

function resolveApiRepo() {
  const override = process.env.SCALEV_API_REPO?.trim();

  if (override) {
    const repoRoot = resolve(ROOT, override);
    if (!existsSync(resolve(repoRoot, API_MARKER))) {
      throw new Error(`SCALEV_API_REPO must point to a ${API_LABEL} checkout containing ${API_MARKER}.`);
    }
    return repoRoot;
  }

  const candidates = readdirSync(WORKSPACE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => resolve(WORKSPACE, entry.name))
    .filter((repoRoot) => existsSync(resolve(repoRoot, API_MARKER)))
    .map((repoRoot) => realpathSync(repoRoot));
  const uniqueCandidates = [...new Set(candidates)];

  if (uniqueCandidates.length !== 1) {
    throw new Error(
      `Expected one sibling ${API_LABEL} checkout; found ${uniqueCandidates.length}. ` +
      "Set SCALEV_API_REPO to the intended checkout."
    );
  }

  return uniqueCandidates[0];
}

let apiRepo;
try {
  apiRepo = resolveApiRepo();
} catch (error) {
  console.error("Submission workspace check failed:");
  console.error(`- ${error.message}`);
  process.exit(1);
}

const requiredFiles = [
  {
    repo: API_LABEL,
    path: "lib/scalev_api_web/controllers/security_txt_controller.ex",
    snippets: ["Contact:", "Policy:", "Canonical:", "Expires:"]
  },
  {
    repo: API_LABEL,
    path: "lib/util/reviewer_seed_audit.ex",
    snippets: [
      "Util.ReviewerSeedAudit",
      "Claude connector review seed",
      "business_unique_id",
      "awb_cancel_order"
    ]
  },
  {
    repo: API_LABEL,
    path: "lib/scalev_api_web/router.ex",
    snippets: [
      "get \"/me\"",
      "get \"/scopes\"",
      "get \"/applications/me\""
    ]
  },
  {
    repo: API_LABEL,
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
      "/v3/me:",
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
    repo: "dev-docs",
    path: "docs/Getting started/scalev-mcp-connector.md",
    snippets: [
      "Scalev MCP exposes 25 tools",
      "https://mcp.scalev.com/mcp",
      "business_unique_id",
      "remote MCP"
    ]
  }
];

const errors = [];

for (const entry of requiredFiles) {
  const repoRoot = entry.repo === API_LABEL ? apiRepo : resolve(WORKSPACE, entry.repo);
  const fullPath = resolve(repoRoot, entry.path);

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
