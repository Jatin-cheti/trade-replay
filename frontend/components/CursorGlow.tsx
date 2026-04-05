import { useEffect } from "react";

export default function CursorGlow() {
  useEffect(() => {
    const syncPointer = (event: MouseEvent) => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    window.addEventListener("mousemove", syncPointer, { passive: true });
    return () => window.removeEventListener("mousemove", syncPointer);
  }, []);

  return <div className="cursor-follow-glow" aria-hidden="true" />;
}
