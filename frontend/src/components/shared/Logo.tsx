interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "h-6 w-6", size }: LogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="nexkan-brand-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFA600" />
          <stop offset="50%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#E63900" />
        </linearGradient>
      </defs>

      {/* Outer Hexagonal Shield Frame */}
      <path
        d="M 256,56 L 440,168 L 440,360 L 256,472 L 72,360 L 72,168 Z"
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertical Column Dividers (detached from shield) */}
      <line
        x1={204}
        y1={160}
        x2={204}
        y2={390}
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        x1={308}
        y1={160}
        x2={308}
        y2={390}
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* Horizontal Column Header Dividers (detached from shield and dividers) */}
      <line
        x1={116}
        y1={188}
        x2={196}
        y2={188}
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        x1={216}
        y1={188}
        x2={296}
        y2={188}
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        x1={316}
        y1={188}
        x2={396}
        y2={188}
        stroke="url(#nexkan-brand-grad)"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* 4 Kanban Cards (White with subtle border for crisp contrast in light & dark themes) */}
      <rect x={126} y={212} width={58} height={52} rx={8} fill="#FFFFFF" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
      <rect x={227} y={212} width={58} height={52} rx={8} fill="#FFFFFF" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
      <rect x={328} y={212} width={58} height={52} rx={8} fill="#FFFFFF" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
      <rect x={227} y={282} width={58} height={52} rx={8} fill="#FFFFFF" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
    </svg>
  );
}

