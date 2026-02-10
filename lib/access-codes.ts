/**
 * Access code validation — reads from keys.txt (same as prod_vitruviai)
 * Also falls back to ACCESS_CODES env var for backward compatibility
 */
import fs from "fs";
import path from "path";

let cachedCodes: string[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

function loadAccessCodes(): string[] {
  const now = Date.now();
  if (cachedCodes && now - lastCacheTime < CACHE_TTL) return cachedCodes;

  const codes: string[] = [];

  // 1. Try keys.txt (primary — matches prod_vitruviai)
  try {
    const keysPath = path.join(process.cwd(), "keys.txt");
    if (fs.existsSync(keysPath)) {
      const fileContent = fs.readFileSync(keysPath, "utf-8");
      const fileCodes = fileContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      codes.push(...fileCodes);
    }
  } catch (err: any) {
    console.error("[Access Codes] Error reading keys.txt:", err.message);
  }

  // 2. Also read ACCESS_CODES env var (fallback)
  const envCodes = process.env.ACCESS_CODES || "";
  if (envCodes) {
    const parsed = envCodes
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    codes.push(...parsed);
  }

  // Deduplicate
  cachedCodes = [...new Set(codes)];
  lastCacheTime = now;
  return cachedCodes;
}

export function isValidAccessCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== "string" || !code.trim()) return false;
  return loadAccessCodes().includes(code.trim());
}

export function getAccessCodeCount(): number {
  return loadAccessCodes().length;
}
