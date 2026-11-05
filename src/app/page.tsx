"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  FileSpreadsheet,
  FileText,
  Menu,
  Plus,
  Save,
  ShieldCheck,
  Table2,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;

const PODS = ["Core Product Pod", "Growth Pod", "Mobile Pod", "Platform Pod"];

type Staged = {
  file: File;
  storedName: string;
  rowCount: number;
  columns: string[];
  mapped: string;
  jsonPath: string;
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadFeedbackPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const podRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pod, setPod] = useState(PODS[0]);
  const [podOpen, setPodOpen] = useState(false);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!podOpen) return;
    const onClick = (e: MouseEvent) => {
      if (podRef.current && !podRef.current.contains(e.target as Node)) {
        setPodOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPodOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [podOpen]);

  const stage = useCallback(async (file: File) => {
    setError(null);
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("Only CSV or XLSX files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is larger than 10 MB.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not save file.");
        return;
      }
      setStaged({
        file,
        storedName: data.storedName,
        rowCount: data.rowCount ?? 0,
        columns: data.columns ?? [],
        mapped: `${data.columns?.length ?? 0}/${data.columns?.length ?? 0}`,
        jsonPath: data.jsonPath,
      });
      console.log("Parsed JSON:", data.json);
    } catch {
      setError("Could not save file. Please try again.");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) stage(f);
  };

  const onAnalyse = () => {
    if (!staged) return;
    router.push(`/analyse?file=${encodeURIComponent(staged.storedName)}`);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f0] text-[#0f2a20] font-[Inter,system-ui,-apple-system,'Segoe_UI',sans-serif]">
      <header className="bg-white border-b border-[#dce5dc]">
        <div className="max-w-[1200px] mx-auto h-14 md:h-16 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 grid place-items-center rounded-lg bg-[#123d2f] text-white">
              <TrendingUp size={20} />
            </span>
            <span className="text-xl font-semibold tracking-tight">Prioritise</span>
            <span className="hidden md:inline-flex px-2 py-0.5 rounded-md bg-[#eef2ec] text-[#4b6256] text-[13px]">
              User feedback intelligence
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div ref={podRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={podOpen}
                onClick={() => setPodOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 border border-[#dce5dc] rounded-lg bg-[#f7faf5] text-[#0f2a20] text-sm font-medium hover:bg-[#eef4ea] cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2e9e5f]" />
                <span className="hidden md:inline">{pod}</span>
                <span className="md:hidden">{pod.split(" ")[0]}</span>
                <ChevronsUpDown size={14} className="text-[#6b7f74]" />
              </button>
              {podOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 mt-2 z-20 w-60 overflow-hidden rounded-lg border border-[#dce5dc] bg-white shadow-lg"
                >
                  {PODS.map((p) => {
                    const active = p === pod;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setPod(p);
                          setPodOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm cursor-pointer transition-colors ${
                          active
                            ? "bg-[#eef4ea] text-[#123d2f] font-medium"
                            : "text-[#0f2a20] hover:bg-[#f7faf5]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2e9e5f]" />
                          {p}
                        </span>
                        {active && <Check size={16} className="text-[#2e9e5f]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Notifications"
              className="hidden md:block relative p-1.5 text-[#0f2a20] cursor-pointer"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#dc2626]" />
            </button>
            <span className="hidden md:block w-px h-6 bg-[#dce5dc]" />
            <button type="button" className="flex items-center gap-1 cursor-pointer">
              <span className="w-8 h-8 md:w-9 md:h-9 grid place-items-center rounded-full bg-[#bfeac9] text-[#123d2f] text-sm font-semibold">
                PM
              </span>
              <ChevronDown size={16} className="hidden md:block text-[#6b7f74]" />
            </button>
            <button type="button" aria-label="Menu" className="md:hidden p-1.5 text-[#0f2a20] cursor-pointer">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-5 md:py-7 pb-[120px] md:pb-7">
        <h1 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-[#123d2f]">
          User Feedback
        </h1>
        <p className="mt-1.5 text-base text-[#123d2f]">
          Turn user feedback into clear, data-backed problem priorities.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1.45fr_1fr] gap-5">
          <section className="bg-white border border-[#dce5dc] rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold">
                <Table2 size={16} className="text-[#123d2f]" /> Feedback dataset
              </h2>
              <span className="md:bg-transparent md:text-[#6b7f74] px-2 py-0.5 md:p-0 rounded-md bg-[#eef2ec] text-[#4b6256] text-[13px]">
                CSV or XLSX
              </span>
            </div>

            <div
              className={`mt-4 p-6 px-4 flex flex-col items-center text-center border-2 border-dashed rounded-xl bg-[#fafcf9] transition-colors ${
                dragging ? "border-[#2e9e5f] bg-[#eaf6ee]" : "border-[#cbd8cd]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="w-10 h-10 grid place-items-center rounded-full bg-[#e8efe7] text-[#123d2f]">
                <UploadCloud size={20} />
              </span>
              <p className="mt-3 text-base font-semibold">Upload your feedback file</p>
              <p className="mt-1 max-w-[256px] text-sm text-[#6b7f74]">
                Drop a CSV or Excel file here, or click to browse (up to 10 MB)
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) stage(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#123d2f] text-white text-base font-medium hover:bg-[#0c2d22] transition-colors cursor-pointer"
                onClick={() => inputRef.current?.click()}
              >
                <Plus size={16} /> Choose file
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-[#b91c1c]">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-between text-[13px] text-[#6b7f74]">
              <span>Staged dataset</span>
              <span>{staged ? "1 file selected" : "No file selected"}</span>
            </div>

            {staged && (
              <div className="mt-2 p-3 flex items-center gap-3 border border-[#dce5dc] rounded-xl bg-[#f3f6f0]">
                <span className="flex-shrink-0 w-10 h-10 grid place-items-center rounded-lg bg-[#cfefd8] text-[#1e6b43]">
                  <FileSpreadsheet size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="max-w-[144px] md:max-w-none overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold">
                      {staged.file.name}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#cfefd8] text-[#1e6b43] text-[13px] font-medium">
                      <CheckCircle2 size={12} /> Ready to process
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-[#6b7f74]">
                    {formatSize(staged.file.size)} • {staged.rowCount} rows •{" "}
                    {staged.columns.length} columns
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6b7f74]">
                    JSON saved to{" "}
                    <code className="rounded bg-white px-1 py-0.5 text-[#123d2f]">
                      {staged.jsonPath}
                    </code>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remove file"
                  className="p-1 rounded-md text-[#4b6256] hover:bg-white cursor-pointer"
                  onClick={() => setStaged(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 flex items-center justify-between gap-2 border-t border-[#e6ede5] text-[13px] text-[#6b7f74]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} /> Auto-anonymizes PII before AI processing
              </span>
              {staged && (
                <span className="md:bg-transparent px-1.5 py-0.5 md:p-0 rounded bg-[#eef2ec]">
                  Columns mapped: {staged.mapped}
                </span>
              )}
            </div>
          </section>

          <section className="bg-white border border-[#dce5dc] rounded-2xl p-5 focus-within:border-[#2e9e5f] focus-within:shadow-[0_0_0_3px_rgba(46,158,95,0.25)] transition-shadow">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold">
                <FileText size={16} className="text-[#123d2f]" /> Project description
              </h2>
              <span className="text-[13px] text-[#6b7f74]">Optional</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7f74]">
              Add a brief description to label and organize this analysis in your workspace.
            </p>
            <label htmlFor="desc" className="block mt-4 text-sm font-semibold">
              Brief project description
            </label>
            <textarea
              id="desc"
              rows={4}
              className="w-full mt-1.5 px-3 py-2.5 resize-none border border-[#dce5dc] rounded-lg bg-[#fafcf9] text-[#0f2a20] text-base placeholder:text-[#9aaba1] focus:outline-none focus:border-[#2e9e5f]"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. Q4 onboarding survey analysis"
            />
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#dce5dc] bg-[#f7faf5] text-[#123d2f] text-sm font-medium hover:bg-[#eef4ea] transition-colors cursor-pointer"
              onClick={() => setSaved(true)}
            >
              <Save size={16} /> {saved ? "Description saved" : "Save description"}
            </button>
            <p className="mt-3 pt-3 flex items-center gap-1.5 border-t border-[#e6ede5] text-[13px] text-[#6b7f74]">
              <CheckCircle2 size={14} className="text-[#2e9e5f] md:hidden" />
              Saved to workspace upon analysis
            </p>
          </section>
        </div>

        <div className="fixed md:static left-0 right-0 bottom-0 z-10 px-4 py-3 md:mt-5 md:p-0 bg-white/95 md:bg-transparent backdrop-blur md:backdrop-blur-none border-t md:border-t-0 border-[#dce5dc]">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <button type="button" className="px-2 py-1 text-base font-medium text-[#0f2a20] hover:underline cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#123d2f] text-white text-base font-semibold hover:bg-[#0c2d22] disabled:bg-[#8fa79b] disabled:cursor-not-allowed transition-colors cursor-pointer"
              onClick={onAnalyse}
              disabled={!staged}
            >
              Analyse Feedback <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
