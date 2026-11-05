//whre to save data

import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const JSON_DIR = path.join(DATA_DIR, "uploads", "json");

export function toPosix(p: string) {
  return p.replace(/\\/g, "/");
}

export function relativePath(p: string) {
  return toPosix(path.relative(process.cwd(), p));
}
