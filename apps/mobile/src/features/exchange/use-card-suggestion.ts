import { useRef, useState } from "react";
import { useApp } from "../../store";
import { userFacingError } from "../sync/user-facing-error";

/**
 * Asks the server which strength card the written text speaks to. A failed
 * suggestion says so and leaves the choice to the person; it never picks a
 * card by itself.
 */
export function useCardSuggestion() {
  const { api } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [card, setCard] = useState<string | null>(null);
  // A suggestion for text that has changed since the request is dropped.
  const request = useRef(0);
  const suggest = async (text: string): Promise<string | null> => {
    const id = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const { card } = await api.suggestTestimonyCard(text);
      if (id !== request.current) return null;
      setCard(card);
      return card;
    } catch (failure) {
      if (id === request.current)
        setError(userFacingError(failure, "AIでカードを選べませんでした"));
      return null;
    } finally {
      if (id === request.current) setBusy(false);
    }
  };
  const reset = () => {
    request.current++;
    setBusy(false);
    setError(null);
    setCard(null);
  };
  return { busy, error, card, suggest, reset };
}
