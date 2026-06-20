import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * UKA shield logo — metallic gradient with UA monogram.
 * SVG with layered gradients/highlights for a 3D look.
 */
export function Logo({ size = 56, className, glow = true }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * (140 / 120)}
      className={cn(glow && "drop-shadow-[0_0_18px_oklch(0.68_0.27_295/0.6)]", className)}
      aria-label="UKA Messenger"
    >
      <defs>
        <linearGradient id="metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.92 0.06 280)" />
          <stop offset="35%" stopColor="oklch(0.55 0.22 295)" />
          <stop offset="65%" stopColor="oklch(0.4 0.2 265)" />
          <stop offset="100%" stopColor="oklch(0.75 0.18 200)" />
        </linearGradient>
        <linearGradient id="bevel" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.55)" />
          <stop offset="60%" stopColor="oklch(1 0 0 / 0)" />
        </linearGradient>
        <linearGradient id="text" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.98 0.02 200)" />
          <stop offset="100%" stopColor="oklch(0.7 0.18 200)" />
        </linearGradient>
      </defs>
      {/* shield body */}
      <path
        d="M60 4 L112 22 V70 C112 100 90 124 60 134 C30 124 8 100 8 70 V22 Z"
        fill="url(#metal)"
        stroke="oklch(0.85 0.12 200 / 0.6)"
        strokeWidth="1.5"
      />
      {/* bevel highlight */}
      <path
        d="M60 8 L107 25 V70 C107 96 88 118 60 128 C32 118 13 96 13 70 V25 Z"
        fill="url(#bevel)"
      />
      {/* inner ring */}
      <path
        d="M60 18 L98 32 V68 C98 92 82 110 60 118 C38 110 22 92 22 68 V32 Z"
        fill="oklch(0.18 0.04 265 / 0.85)"
        stroke="oklch(0.82 0.17 195 / 0.7)"
        strokeWidth="1"
      />
      {/* UA monogram */}
      <text
        x="60"
        y="84"
        textAnchor="middle"
        fontFamily="Orbitron, sans-serif"
        fontWeight="900"
        fontSize="44"
        fill="url(#text)"
        letterSpacing="-2"
      >
        UA
      </text>
    </svg>
  );
}
