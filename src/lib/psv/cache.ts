import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function psvCacheDir(): string {
  return process.env.PSV_CACHE_DIR || join(tmpdir(), "credentialing-psv-cache");
}

export async function ensureCacheDir(): Promise<string> {
  const dir = psvCacheDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function readCachedFile(
  name: string,
  maxAgeMs: number,
): Promise<Buffer | null> {
  try {
    const path = join(psvCacheDir(), name);
    const info = await stat(path);
    if (Date.now() - info.mtimeMs > maxAgeMs) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function writeCachedFile(
  name: string,
  data: Buffer | string,
): Promise<string> {
  const dir = await ensureCacheDir();
  const path = join(dir, name);
  await writeFile(path, data);
  return path;
}
