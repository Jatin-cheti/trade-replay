import { useState, useEffect } from "react";

const MOBILE_BP = 768;
const TABLET_BP = 1024;

export function useResponsive() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    isMobile: width < MOBILE_BP,
    isTablet: width >= MOBILE_BP && width < TABLET_BP,
    isDesktop: width >= TABLET_BP,
    width,
  };
}
