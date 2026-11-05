# Data folder

Everything the upload flow writes to disk lives here.

```
data/
└── uploads/
    └── json/   Parsed data, stored as JSON
```

The original uploaded `.csv` / `.xlsx` is **not** kept. It is parsed in memory,
then only the JSON result is written here. Only the first **100 rows** are
read, but **all columns** are kept as keys. Each `<timestamp>-<name>.json` is an
array of objects where the **first row is the key set** and every row below
becomes one object. Blank headers use the key `null` (then `null_1`, `null_2`,
...), and blank or whitespace-only cells are stored as `null`:

```json
[
  { "id": "1", "feedback": "Great app" },
  { "id": "2", "feedback": "Too slow" }
]
```

These folders are created automatically on the first upload and are ignored by
git (see `.gitignore`).
