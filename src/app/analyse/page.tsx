import { readFile } from "fs/promises";
import path from "path";
import { ConsoleLogger } from "./logger";
import { JSON_DIR, relativePath } from "@/lib/uploads";

export const instant = false;

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string | string[] }>;
}) {
  const { file } = await searchParams;
  const requested = Array.isArray(file) ? file[0] : file;

  let details: unknown = { error: "No file. Upload a dataset first." };

  if (requested) {
    const storedName = path.basename(requested);
    if (/^\d+-[a-zA-Z0-9._-]+$/.test(storedName)) {
      const jsonFile = path.join(JSON_DIR, `${storedName}.json`);
      try {
        const raw = await readFile(jsonFile, "utf8");
        const data = JSON.parse(raw);
        details = {
          storedName,
          jsonPath: relativePath(jsonFile),
          rowCount: Array.isArray(data) ? data.length : null,
          columns:
            Array.isArray(data) && data.length > 0 && typeof data[0] === "object"
              ? Object.keys(data[0])
              : [],
          data,
        };
      } catch {
        details = { error: `No saved JSON found for "${storedName}".` };
      }
    } else {
      details = { error: "Invalid file reference." };
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <ConsoleLogger details={details} />
    </main>
  );
}
