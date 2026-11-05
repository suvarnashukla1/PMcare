import { mkdir, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { JSON_DIR, relativePath } from "@/lib/uploads";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 100;

type Row = Record<string, unknown>;

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets.");
  const sheet = workbook.Sheets[sheetName];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  });

  const header = matrix[0] ?? [];
  const dataRows = matrix.slice(1, MAX_ROWS + 1);

  const width = dataRows.reduce(
    (max, cells) => Math.max(max, cells.length),
    header.length,
  );

  const seen = new Map<string, number>();
  const columns = Array.from({ length: width }, (_, i) => {
    const raw = header[i];
    let base =
      typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
    if (base === "") base = "null";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });

  const rows: Row[] = dataRows.map((cells) => {
    const out: Row = {};
    columns.forEach((col, i) => {
      const value = cells[i] ?? null;
      out[col] =
        typeof value === "string" && value.trim() === "" ? null : value;
    });
    return out;
  });

  return { sheetName, rows, columns };
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Only CSV or XLSX files are supported." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 10 MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed: ReturnType<typeof parseWorkbook>;
  try {
    parsed = parseWorkbook(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Could not read the file: ${err.message}`
            : "Could not read the file.",
      },
      { status: 400 },
    );
  }

  await mkdir(JSON_DIR, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const jsonFile = path.join(JSON_DIR, `${storedName}.json`);

  await writeFile(jsonFile, JSON.stringify(parsed.rows, null, 2), "utf8");

  return NextResponse.json({
    ok: true,
    storedName,
    jsonPath: relativePath(jsonFile),
    size: file.size,
    sheetName: parsed.sheetName,
    columns: parsed.columns,
    rowCount: parsed.rows.length,
    json: parsed.rows,
  });
}

export async function GET() {
  await mkdir(JSON_DIR, { recursive: true });
  const names = await readdir(JSON_DIR);
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const info = await stat(path.join(JSON_DIR, name));
        return { name, size: info.size, modifiedAt: info.mtime.toISOString() };
      }),
  );
  files.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  return NextResponse.json({ files });
}
