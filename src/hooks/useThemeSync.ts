import { useEffect } from "react";

export function useThemeSync(theme: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystem = () => root.classList.toggle("dark", mq.matches);

    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }
    if (theme === "light") {
      root.classList.remove("dark");
      return;
    }

    applySystem();
    mq.addEventListener("change", applySystem);
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark") !== mq.matches) applySystem();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mq.removeEventListener("change", applySystem);
      observer.disconnect();
    };
  }, [theme]);
}
