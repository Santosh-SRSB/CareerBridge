import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "public");
const src = join(here, "..", "..", "web", "public");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
writeFileSync(join(dest, "CNAME"), "www.srsbcareerbridge.com\n");
writeFileSync(join(dest, ".nojekyll"), "");
