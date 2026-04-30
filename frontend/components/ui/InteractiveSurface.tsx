import { ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface InteractiveSurfaceProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  intensity?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function InteractiveSurface({
  children,
  className,
  disabled = false,
  intensity = 8,
  onClick,
  style,
}: InteractiveSurfaceProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x / rect.width) - 0.5) * intensity;
    const rotateX = (0.5 - (y / rect.height)) * intensity;

    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
    ref.current.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
    ref.current.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
  };

  const handleLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.995 }}
      className={cn("interactive-surface", !disabled && "interactive-surface--active", className)}
      style={style}
    >
      <div className="interactive-surface__glow" aria-hidden="true" />
      {children}
    </motion.div>
  );
}
