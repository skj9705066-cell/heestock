// Prebuild step — downloads DART's master company list (corpCode.xml) and
// writes the parsed result to src/data/dart-corps.json so the runtime
// /api/stock-search route can search Korean smallcaps (e.g. 파두 / 440110)
// without making a 3.5 MB cold-start fetch on every Vercel function spin-up.
//
// Skips silently if DART_API_KEY is not set or DART is unreachable — leaves
// any existing JSON in place so the previous snapshot keeps working.

import { inflateRawSync } from "node:zlib";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const OUT_PATH   = resolve(__dirname, "..", "src", "data", "dart-corps.json");

// .env.local is auto-loaded by `next build` itself, but `npm run prebuild`
// fires before that, so we read it manually.
if (!process.env.DART_API_KEY) {
  for (const fname of [".env.local", ".env"]) {
    const envPath = resolve(__dirname, "..", fname);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
const DART_KEY = process.env.DART_API_KEY;
if (!DART_KEY) {
  console.warn("[prebuild-dart] DART_API_KEY not set — skipping (will use existing snapshot if any)");
  if (!existsSync(OUT_PATH)) {
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, "[]", "utf-8");
    console.warn("[prebuild-dart] wrote empty fallback to", OUT_PATH);
  }
  process.exit(0);
}

function unzipFirst(buffer) {
  // Find EOCD record (end-of-central-directory)
  let eocdPos = -1;
  const searchStart = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocdPos = i; break; }
  }
  if (eocdPos < 0) throw new Error("EOCD not found");
  const cdOffset       = buffer.readUInt32LE(eocdPos + 16);
  if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error("CD sig mismatch");
  const compression    = buffer.readUInt16LE(cdOffset + 10);
  const compressedSize = buffer.readUInt32LE(cdOffset + 20);
  const localHdrOffset = buffer.readUInt32LE(cdOffset + 42);
  if (buffer.readUInt32LE(localHdrOffset) !== 0x04034b50) throw new Error("LFH sig mismatch");
  const nameLen  = buffer.readUInt16LE(localHdrOffset + 26);
  const extraLen = buffer.readUInt16LE(localHdrOffset + 28);
  const dataStart = localHdrOffset + 30 + nameLen + extraLen;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);
  if (compression === 0) return data;
  if (compression === 8) return inflateRawSync(data);
  throw new Error(`unsupported compression ${compression}`);
}

try {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(DART_KEY)}`;
  console.info("[prebuild-dart] fetching corpCode.xml ...");
  const t0  = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.info(`[prebuild-dart] downloaded ${buf.length} B in ${Date.now() - t0} ms`);

  const xml = unzipFirst(buf).toString("utf-8");
  console.info(`[prebuild-dart] extracted ${xml.length} B XML`);

  const listBlockRe = /<list>([\s\S]*?)<\/list>/g;
  const codeRe = /<corp_code>([^<]*)<\/corp_code>/;
  const nameRe = /<corp_name>([^<]*)<\/corp_name>/;
  const stkRe  = /<stock_code>([^<]*)<\/stock_code>/;

  const corps = [];
  let m;
  while ((m = listBlockRe.exec(xml)) !== null) {
    const block = m[1];
    const stockCode = (stkRe.exec(block)?.[1] ?? "").trim();
    if (!stockCode) continue; // unlisted
    const corpCode = (codeRe.exec(block)?.[1] ?? "").trim();
    const corpName = (nameRe.exec(block)?.[1] ?? "").trim();
    if (!corpCode || !corpName) continue;
    corps.push({ corpCode, corpName, stockCode });
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(corps), "utf-8");
  console.info(`[prebuild-dart] wrote ${corps.length} listed corps to ${OUT_PATH}`);
} catch (err) {
  console.warn(`[prebuild-dart] failed: ${err.message} — keeping existing snapshot`);
  if (!existsSync(OUT_PATH)) {
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, "[]", "utf-8");
  }
  // Don't fail the build — runtime can still fall back to KR_SECTOR_INDEX
  process.exit(0);
}
