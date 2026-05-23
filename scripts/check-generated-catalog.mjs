import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , generatorPath, generatedPath] = process.argv;

if (!generatorPath || !generatedPath) {
  console.error(
    "Usage: node scripts/check-generated-catalog.mjs <generator> <generated-file>"
  );
  process.exit(2);
}

const outputPath = resolve(generatedPath);
const before = readFileSync(outputPath, "utf8");

const result = spawnSync("node", [generatorPath], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const after = readFileSync(outputPath, "utf8");

if (after !== before) {
  console.error(`${generatedPath} was stale and has been regenerated.`);
  process.exit(1);
}

console.log(`${generatedPath} is up to date.`);
