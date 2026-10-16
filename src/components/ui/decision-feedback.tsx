"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const Announce = createContext<(message: string) => void>(() => {});

/**
 * Page-level confirmation for decisions (reviews, booking answers). A decision often removes its own button
 * (a published profile no longer shows "Publier"), so the message lives above the forms
 * and survives the refresh that follows the action.
 */
export function DecisionFeedback({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Announce.Provider value={setMessage}>
      <p role="status" aria-live="polite" className={message ? "mt-4 rounded-(--radius-field) bg-surface p-4 text-sm" : "sr-only"}>
        {message}
      </p>
      {children}
    </Announce.Provider>
  );
}

export const useAnnounce = () => useContext(Announce);
