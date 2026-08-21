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
writeFileSync(
  join(dest, "robots.txt"),
  `User-agent: *
Allow: /

Sitemap: https://www.srsbcareerbridge.com/sitemap.xml
`,
);
writeFileSync(
  join(dest, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.srsbcareerbridge.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
);
