"use client";

import { useEffect, useState } from "react";

export function ConsoleLogger({ details }: { details: unknown }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duplicateRowsRemoved, setDuplicateRowsRemoved] = useState(0);

  useEffect(() => {
    console.log("File details:", details);

    const controller = new AbortController();
    let active = true;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      if (active) {
        setError("The analysis timed out. Please try again.");
        setIsLoading(false);
      }
    }, 90_000);

    async function getAnswer() {
      try {
        const response = await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ details }),
          signal: controller.signal,
        });
        const result: unknown = await response.json();

        if (
          typeof result !== "object" ||
          result === null ||
          !("answer" in result) ||
          typeof result.answer !== "string"
        ) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "The analysis response was invalid.";
          throw new Error(message);
        }

        if (active) {
          setAnswer(result.answer);
          setDuplicateRowsRemoved(
            "duplicateRowsRemoved" in result &&
              typeof result.duplicateRowsRemoved === "number"
              ? result.duplicateRowsRemoved
              : 0,
          );
        }
      } catch (err) {
        if (!active || (err instanceof Error && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Analysis failed.");
      } finally {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
        if (active) setIsLoading(false);
      }
    }

    void getAnswer();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [details]);

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 text-black">
      {isLoading && (
        <p role="status" aria-live="polite">
          Request sent to Groq. Waiting for its response… ({elapsedSeconds}s)
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {duplicateRowsRemoved > 0 && (
        <p className="mb-4 text-sm text-black">
          Removed {duplicateRowsRemoved} duplicate submission
          {duplicateRowsRemoved === 1 ? "" : "s"} before analysis.
        </p>
      )}
      {answer && <h2 className="text-2xl font-semibold">{answer}</h2>}
    </section>
  );
}
