/**
 * Minimal .env.local / .env loader for non-Next processes (the MCP server and
 * demo scripts run under tsx, which does not read env files). Existing
 * process.env values always win. Never throws if files are absent.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnvFiles(startDir: string = process.cwd()): void {
  for (const file of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(startDir, file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!line.trim() || line.trim().startsWith("#") || !m) continue;
      const [, key, valueRaw] = m;
      if (process.env[key] !== undefined) continue;
      process.env[key] = valueRaw.replace(/^["']|["']$/g, "");
    }
  }
}

// Side effect on import: non-Next processes just `import "../src/lib/load-env";`
loadEnvFiles();
