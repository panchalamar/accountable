import { useRef } from "react";

/**
 * Radix returns focus to its own Trigger when a dialog closes. These dialogs
 * open from buttons that set state, so this remembers whatever had focus when
 * the dialog opened and puts focus back there when it closes.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      if (target && target.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
