interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "h-6 w-6", size }: LogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={style}
    >
      {/* Frame/container (dark gray outline, rounded) */}
      <rect
        x="20"
        y="22"
        width="65"
        height="56"
        rx="6"
        stroke="currentColor"
        strokeWidth="6"
      />
      {/* Sliding orange card with keyframe animation */}
      <rect
        x="12"
        y="33"
        width="48"
        height="34"
        rx="4"
        fill="#f97316"
        className="animate-logo-slide"
      />
    </svg>
  );
}
