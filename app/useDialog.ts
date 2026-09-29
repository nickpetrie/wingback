import { useEffect, type RefObject } from "react";

/** What a slide-out panel owes the person who opened it: Escape closes it,
 * focus lands on its close button so a keyboard or screen reader is inside it
 * rather than still on the page behind, focus goes back to the trigger when it
 * closes, and the page behind stops scrolling while it's up.
 *
 * `close` must be referentially stable (a bare setState, or useCallback):
 * a new function every render re-runs the effect, which re-focuses the close
 * button on every keystroke. */
export function useDialog(
  open: boolean,
  close: () => void,
  trigger: RefObject<HTMLElement | null>,
  first: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    first.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, close, trigger, first]);
}
