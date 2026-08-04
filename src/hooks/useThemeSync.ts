import { useEffect } from "react";

/**
 * Applies the `dark` class to <html> based on a theme preference
 * ("light" | "dark" | "system"). Falls back to system preference when no
 * explicit choice is available (e.g. on the public site, before settings load).
 */
export function useThemeSync(theme: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);

    if (theme === "dark") {
      apply(true);
      return;
    }
    if (theme === "light") {
      apply(false);
      return;
    }

    // system (or unset)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);
}
