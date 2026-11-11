import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const roots = ["packages/kratt-core/src", "packages/kratt-core/test", "packages/kratt-runtime/src", "packages/kratt-runtime/test"];
const files = [];
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (entry.name.endsWith(".mjs")) files.push(full);
  }
}
for (const root of roots) visit(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
process.stdout.write(`Syntax checked ${files.length} JavaScript modules.\n`);
