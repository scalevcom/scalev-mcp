import { resolveCaa } from "node:dns/promises";

const REPORT_ONLY = process.argv.includes("--report-only");

const EXPECTED_SECURITY_HEADERS = {
  "strict-transport-security": /^(?=.*max-age=(?:31536000|63072000))(?=.*includeSubDomains)(?=.*preload).*/iu,
  "x-content-type-options": /^nosniff$/iu,
  "x-frame-options": /^DENY$/iu
};

const checks = [
  {
    name: "MCP protected-resource metadata",
    url: "https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp",
    expectStatus: 200,
    expectJsonFields: ["authorization_servers", "resource"]
  },
  {
    name: "Nexus OAuth authorization-server metadata",
    url: "https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server",
    expectStatus: 200,
    expectJsonFields: ["issuer", "authorization_endpoint", "token_endpoint", "registration_endpoint"]
  },
  {
    name: "MCP health",
    url: "https://mcp.scalev.com/health",
    expectStatus: 200,
    expectJsonFields: ["status"]
  },
  {
    name: "MCP security.txt",
    url: "https://mcp.scalev.com/.well-known/security.txt",
    expectStatus: 200,
    expectText: ["Contact:", "Policy:", "Canonical:", "Expires:"]
  },
  {
    name: "Nexus API security.txt",
    url: "https://api.scalev.com/.well-known/security.txt",
    expectStatus: 200,
    expectText: ["Contact:", "Policy:", "Canonical:", "Expires:"]
  },
  {
    name: "Scalev Claude landing page",
    url: "https://scalev.com/claude",
    expectStatus: 200,
    expectText: ["Scalev Claude Connector", "https://mcp.scalev.com/mcp", "Add to Claude"]
  },
  {
    name: "English connector docs",
    url: "https://docs.scalev.com/en/scalev-mcp-connector",
    expectStatus: 200,
    expectText: ["Scalev MCP", "https://mcp.scalev.com/mcp"]
  },
  {
    name: "Indonesian connector docs",
    url: "https://docs.scalev.com/id/konektor-scalev-mcp",
    expectStatus: 200,
    expectText: ["Scalev MCP", "https://mcp.scalev.com/mcp"]
  },
  {
    name: "Privacy policy",
    url: "https://scalev.com/privacy",
    expectStatus: 200
  },
  {
    name: "Terms",
    url: "https://scalev.com/terms",
    expectStatus: 200
  },
  {
    name: "Support",
    url: "https://scalev.com/contact-us",
    expectStatus: 200
  },
  {
    name: "Scalev status page",
    url: "https://status.scalev.com",
    expectStatus: 200
  },
  {
    name: "Unauthenticated MCP challenge",
    url: "https://mcp.scalev.com/mcp",
    expectStatus: 401,
    expectHeaders: {
      "www-authenticate": /resource_metadata="https:\/\/mcp\.scalev\.com\/\.well-known\/oauth-protected-resource\/mcp"/iu
    }
  },
  {
    name: "MCP allowed Claude Origin challenge",
    url: "https://mcp.scalev.com/mcp",
    headers: {
      Origin: "https://claude.ai"
    },
    expectStatus: 401,
    expectHeaders: {
      "www-authenticate": /resource_metadata="https:\/\/mcp\.scalev\.com\/\.well-known\/oauth-protected-resource\/mcp"/iu
    }
  },
  {
    name: "MCP allowed OpenAI Origin challenge",
    url: "https://mcp.scalev.com/mcp",
    headers: {
      Origin: "https://chatgpt.com"
    },
    expectStatus: 401,
    expectHeaders: {
      "www-authenticate": /resource_metadata="https:\/\/mcp\.scalev\.com\/\.well-known\/oauth-protected-resource\/mcp"/iu
    }
  },
  {
    name: "MCP disallowed browser Origin",
    url: "https://mcp.scalev.com/mcp",
    headers: {
      Origin: "https://example.invalid"
    },
    expectStatus: 403,
    expectText: ["forbidden_origin"]
  }
];

const failures = [];
const results = [];

for (const check of checks) {
  await runCheck(check);
}

for (const hostname of ["scalev.com", "mcp.scalev.com", "api.scalev.com"]) {
  await runCaaCheck(hostname);
}

printResults();

if (failures.length > 0 && !REPORT_ONLY) {
  process.exit(1);
}

async function runCheck(check) {
  try {
    const response = await fetch(check.url, {
      headers: check.headers,
      redirect: "follow"
    });

    const text = await response.text();
    const errors = [];

    if (response.status !== check.expectStatus) {
      errors.push(`expected HTTP ${check.expectStatus}, got ${response.status}`);
    }

    if (check.url.startsWith("https://mcp.scalev.com") || check.url.startsWith("https://api.scalev.com")) {
      for (const [header, pattern] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
        const value = response.headers.get(header) || "";
        if (!pattern.test(value)) errors.push(`missing or invalid ${header}: ${JSON.stringify(value)}`);
      }
    }

    for (const [header, pattern] of Object.entries(check.expectHeaders || {})) {
      const value = response.headers.get(header) || "";
      if (!pattern.test(value)) errors.push(`missing or invalid ${header}: ${JSON.stringify(value)}`);
    }

    if (check.expectJsonFields) {
      try {
        const json = JSON.parse(text);
        for (const field of check.expectJsonFields) {
          if (!(field in json)) errors.push(`missing JSON field: ${field}`);
        }
      } catch {
        errors.push("response is not valid JSON");
      }
    }

    for (const expectedText of check.expectText || []) {
      if (!text.includes(expectedText)) errors.push(`missing text: ${expectedText}`);
    }

    recordResult(check, response.status, errors);
  } catch (error) {
    recordResult(check, "request_failed", [error.message]);
  }
}

async function runCaaCheck(hostname) {
  const name = `CAA ${hostname}`;

  try {
    const result = await resolveEffectiveCaa(hostname);
    const errors = [];

    if (!result) {
      errors.push("no effective CAA issue or issuewild record found");
      recordResult({ name }, "no_records", errors);
      return;
    }

    recordResult({ name }, result.source, []);
  } catch (error) {
    recordResult({ name }, "request_failed", [error.message]);
  }
}

async function resolveEffectiveCaa(hostname) {
  const labels = hostname.split(".");

  for (let index = 0; index <= labels.length - 2; index += 1) {
    const source = labels.slice(index).join(".");
    const records = await resolveCaaOrEmpty(source);

    if (records.some((record) => ["issue", "issuewild"].includes(record.tag))) {
      return { source, records };
    }
  }

  return undefined;
}

async function resolveCaaOrEmpty(hostname) {
  try {
    return await resolveCaa(hostname);
  } catch (error) {
    if (["ENODATA", "ENOTFOUND"].includes(error.code)) return [];
    throw error;
  }
}

function recordResult(check, status, errors) {
  const result = { name: check.name, status, errors };
  results.push(result);

  for (const error of errors) {
    failures.push(`${check.name}: ${error}`);
  }
}

function printResults() {
  for (const result of results) {
    if (result.errors.length === 0) {
      console.log(`PASS ${result.name} (${result.status})`);
      continue;
    }

    console.log(`FAIL ${result.name} (${result.status})`);
    for (const error of result.errors) console.log(`  - ${error}`);
  }

  if (failures.length === 0) {
    console.log("Live readiness check passed.");
    return;
  }

  console.log(`Live readiness check found ${failures.length} issue(s).`);
  if (REPORT_ONLY) console.log("Report-only mode enabled; exiting 0.");
}
