import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FINAL_MODE = process.argv.includes("--final");

const EXPECTED_TOOLS = [
  "get_me",
  "get_docs",
  "search",
  "get",
  "execute_safe",
  "execute_destructive",
  "list_landing_pages",
  "list_landing_page_tags",
  "get_landing_page",
  "get_landing_page_public_view",
  "create_landing_page",
  "update_landing_page",
  "update_landing_page_tags",
  "delete_landing_page",
  "list_landing_page_displays",
  "create_landing_page_display",
  "validate_landing_page_display",
  "get_landing_page_display",
  "delete_landing_page_display",
  "list_orders",
  "get_order",
  "create_order",
  "update_order",
  "change_order_status",
  "get_order_statistics"
];

const REQUIRED_PROMPT_SNIPPETS = [
  "## Prompt 1",
  "## Prompt 2",
  "## Prompt 3",
  "list my connected businesses",
  "Create a draft HTML Mode landing page",
  "find pending orders",
  "## Negative Checks",
  "execute_safe",
  "business_unique_id",
  "OAuth revoke and reconnect"
];

const REQUIRED_NEGATIVE_CHECKS = [
  "Missing selector",
  "Safe tool refuses destructive action",
  "Destructive tool refuses safe action",
  "OAuth revoke and reconnect",
  "Response/log privacy"
];

const errors = [];

const prompts = read("assets/reviewer-evidence/prompts.md");
const matrix = read("assets/reviewer-evidence/tool-exercise-matrix.md");

for (const snippet of REQUIRED_PROMPT_SNIPPETS) {
  if (!prompts.includes(snippet)) {
    errors.push(`assets/reviewer-evidence/prompts.md missing snippet: ${snippet}`);
  }
}

for (const toolName of EXPECTED_TOOLS) {
  if (!matrix.includes(`| \`${toolName}\` |`)) {
    errors.push(`assets/reviewer-evidence/tool-exercise-matrix.md missing tool row: ${toolName}`);
  }
}

for (const checkName of REQUIRED_NEGATIVE_CHECKS) {
  if (!matrix.includes(`| ${checkName} |`)) {
    errors.push(`assets/reviewer-evidence/tool-exercise-matrix.md missing negative check: ${checkName}`);
  }
}

const matrixToolRows = matrix.match(/^\| `[^`]+` \|/gmu) || [];
if (matrixToolRows.length !== EXPECTED_TOOLS.length) {
  errors.push(
    `assets/reviewer-evidence/tool-exercise-matrix.md must have ${EXPECTED_TOOLS.length} tool rows, got ${matrixToolRows.length}`
  );
}

if (FINAL_MODE) {
  for (const [path, text] of [
    ["assets/reviewer-evidence/prompts.md", prompts],
    ["assets/reviewer-evidence/tool-exercise-matrix.md", matrix]
  ]) {
    if (/PENDING_|Pending|Capture final Claude custom-connector/u.test(text)) {
      errors.push(`${path} still contains pending reviewer evidence markers in final mode`);
    }
  }
}

if (errors.length > 0) {
  console.error("Reviewer evidence check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Reviewer evidence check passed (${EXPECTED_TOOLS.length} tools, ${REQUIRED_NEGATIVE_CHECKS.length} negative checks).`
);

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}
