import React, { createContext, useContext, useState } from "react";

type Outcome = "completed" | "pending" | null;
const Context = createContext<{
  outcome: Outcome;
  setOutcome: (outcome: Outcome) => void;
  cleanup: (() => Promise<void>) | null;
  setCleanup: (cleanup: (() => Promise<void>) | null) => void;
  cleanupError: string | null;
  setCleanupError: (error: string | null) => void;
} | null>(null);

/** Kept above the account-scoped store, which unmounts when all sessions are revoked. */
export function DeletionOutcomeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [cleanup, setCleanupState] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  return (
    <Context.Provider
      value={{
        outcome,
        setOutcome,
        cleanup,
        setCleanup: (cleanup) => setCleanupState(() => cleanup),
        cleanupError,
        setCleanupError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDeletionOutcome() {
  const value = useContext(Context);
  if (!value) throw new Error("DeletionOutcomeProviderが必要です");
  return value;
}
