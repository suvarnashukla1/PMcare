import { NextResponse } from "next/server";

const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_DETAILS_LENGTH = 100_000;
const SYSTEM_PROMPT =
  `Analyze the open-ended feedback in this user research CSV

1. Assign each response a short, meaningful problem category based on its actual meaning.
2. Use the respondent ID to identify each response.
3. Allow multiple categories if a response mentions multiple problems.
4. If a response has no suggestion, label it No Additional Suggestion.
5. Return only the respondent ID and assigned category/categories.

Do not calculate averages, percentages, severity scores, or priority rankings. JavaScript will handle all calculations separately.

Keep categories consistent across all responses and return the results in a structured JSON format.`;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deduplicateLatestSubmissions(
  rows: Record<string, unknown>[],
  nameColumn: string,
  timestampColumn: string | undefined,
) {
  const latestByName = new Map<
    string,
    { index: number; timestamp: number | null }
  >();
  const unnamedRows: number[] = [];

  rows.forEach((row, index) => {
    const rawName = row[nameColumn];
    const name =
      rawName == null
        ? ""
        : String(rawName).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    if (!name) {
      unnamedRows.push(index);
      return;
    }

    const rawTimestamp = timestampColumn ? row[timestampColumn] : null;
    const parsedTimestamp =
      rawTimestamp == null || String(rawTimestamp).trim() === ""
        ? Number.NaN
        : Date.parse(String(rawTimestamp));
    const timestamp = Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
    const previous = latestByName.get(name);

    if (
      !previous ||
      (timestamp !== null &&
        (previous.timestamp === null || timestamp >= previous.timestamp)) ||
      (timestamp === null && previous.timestamp === null)
    ) {
      latestByName.set(name, { index, timestamp });
    }
  });

  const keptIndexes = [
    ...unnamedRows,
    ...Array.from(latestByName.values(), ({ index }) => index),
  ].sort((a, b) => a - b);

  return {
    rows: keptIndexes.map((index) => rows[index]),
    duplicateRowsRemoved: rows.length - keptIndexes.length,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq is not configured. Set GROQ_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !isRecord(body.details) ||
    !Array.isArray(body.details.data)
  ) {
    return NextResponse.json(
      { error: "Dataset details with row data are required." },
      { status: 400 },
    );
  }

  const rows = body.details.data;
  const providedColumns = body.details.columns;
  const columns = Array.isArray(providedColumns)
    ? providedColumns.filter((column): column is string => typeof column === "string")
    : [];
  if (columns.length === 0 && rows.every(isRecord)) {
    columns.push(...new Set(rows.flatMap((row) => Object.keys(row))));
  }

  if (columns.length === 0 || !rows.every(isRecord)) {
    return NextResponse.json(
      { error: "The dataset must contain rows with column names." },
      { status: 400 },
    );
  }

  const nameColumn = columns.find(
    (column) => column.trim().toLowerCase() === "name",
  );
  if (!nameColumn) {
    return NextResponse.json(
      { error: "The dataset must include a Name column to filter duplicate respondents." },
      { status: 400 },
    );
  }
  const timestampColumn = columns.find(
    (column) => column.trim().toLowerCase() === "timestamp",
  );
  const deduplicated = deduplicateLatestSubmissions(
    rows,
    nameColumn,
    timestampColumn,
  );

  const compactDataset = JSON.stringify({
    columns,
    rows: deduplicated.rows.map((row) =>
      columns.map((column) => row[column] ?? null),
    ),
  });
  if (compactDataset.length > MAX_DETAILS_LENGTH) {
    return NextResponse.json(
      { error: "The dataset is too large to analyze in one request." },
      { status: 413 },
    );
  }

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Dataset in compact format (each row follows the column order):\n${compactDataset}`,
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(80_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Groq took too long to respond. Please try again." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Could not connect to Groq. Please try again." },
      { status: 502 },
    );
  }

  let result: unknown;
  try {
    result = await groqResponse.json();
  } catch {
    return NextResponse.json(
      { error: "Groq returned an invalid response." },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const message =
      isRecord(result) && isRecord(result.error) && typeof result.error.message === "string"
        ? result.error.message
        : "Groq could not analyze the dataset.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const answer =
    isRecord(result) &&
    Array.isArray(result.choices) &&
    isRecord(result.choices[0]) &&
    isRecord(result.choices[0].message) &&
    typeof result.choices[0].message.content === "string"
      ? result.choices[0].message.content.trim()
      : "";

  if (!answer) {
    return NextResponse.json(
      { error: "Groq did not return an answer." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    answer,
    rowsAnalyzed: deduplicated.rows.length,
    duplicateRowsRemoved: deduplicated.duplicateRowsRemoved,
  });
}
