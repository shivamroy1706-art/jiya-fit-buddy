type LogoProps = {
  size?: number;
  className?: string;
  withRing?: boolean;
};

/**
 * AI Fitness Trainer logo — hand-built SVG vector.
 * Circular black badge, lime ring, "Ai" lettering, barbell + sprinter.
 */
export function Logo({ size = 120, className, withRing = true }: LogoProps) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="AI Fitness Trainer logo"
    >
      <defs>
        <linearGradient id="limeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4FF3F" />
          <stop offset="100%" stopColor="#8FBF00" />
        </linearGradient>
        <filter id="limeGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="120" cy="120" r="118" fill="#050805" />
      {withRing && (
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          stroke="url(#limeGrad)"
          strokeWidth="4"
          filter="url(#limeGlow)"
        />
      )}

      {/* "A" */}
      <path d="M104 52 L120 52 L100 150 L82 150 Z" fill="#FFFFFF" />
      <path d="M120 52 L134 52 L128 150 L110 150 Z" fill="#FFFFFF" opacity="0.92" />

      {/* lowercase i */}
      <circle cx="160" cy="58" r="11" fill="url(#limeGrad)" />
      <rect x="151" y="76" width="18" height="74" rx="3" fill="url(#limeGrad)" />

      {/* barbell */}
      <g fill="url(#limeGrad)">
        <rect x="52" y="106" width="136" height="10" rx="5" />
        <rect x="42" y="94" width="10" height="34" rx="3" />
        <rect x="30" y="99" width="9" height="24" rx="3" />
        <rect x="188" y="94" width="10" height="34" rx="3" />
        <rect x="201" y="99" width="9" height="24" rx="3" />
      </g>

      {/* sprinting runner silhouette */}
      <g fill="#050805" stroke="url(#limeGrad)" strokeWidth="2.4" strokeLinejoin="round">
        <circle cx="132" cy="88" r="7.5" />
        <path d="M126 96 L142 100 L138 116 L124 112 Z" />
        <path d="M126 98 L110 104 L104 96" fill="none" strokeLinecap="round" />
        <path d="M141 101 L152 96" fill="none" strokeLinecap="round" />
        <path d="M128 114 L118 130 L104 134" fill="none" strokeLinecap="round" />
        <path d="M136 116 L142 132 L136 142" fill="none" strokeLinecap="round" />
      </g>
      <g stroke="url(#limeGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M96 118 L82 122" />
        <path d="M100 128 L84 134" />
      </g>

      {/* wordmark */}
      <text
        x="120"
        y="184"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Poppins, Inter, sans-serif"
        fontWeight="800"
        fontSize="26"
        letterSpacing="2"
      >
        AI FITNESS
      </text>
      <text
        x="120"
        y="206"
        textAnchor="middle"
        fill="#AEEA00"
        fontFamily="Poppins, Inter, sans-serif"
        fontWeight="700"
        fontSize="15"
        letterSpacing="5"
      >
        TRAINER
      </text>
      <g stroke="#AEEA00" strokeWidth="1.6" strokeLinecap="round">
        <path d="M40 201 L62 201" />
        <path d="M178 201 L200 201" />
      </g>
    </svg>
  );
}
