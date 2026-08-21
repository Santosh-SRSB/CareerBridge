import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.GITHUB_PAGES !== "true") process.exit(0);

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "/CareerBridge";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(html|css|js)$/.test(entry.name)) continue;
    const before = readFileSync(full, "utf8");
    const rewritten = before
      .replace(/(src=|href=|url\()(["']?)\/(?!\/|CareerBridge\/)/g, `$1$2${prefix}/`)
      .replace(/(["'])\/(?!\/|CareerBridge\/)/g, `$1${prefix}/`);
    if (rewritten !== before) writeFileSync(full, rewritten);
  }
}

walk(root);
