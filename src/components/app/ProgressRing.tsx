import { cn } from "@/lib/utils";

type Props = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
};

export function ProgressRing({
  value,
  size = 104,
  stroke = 10,
  label,
  sublabel,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg font-bold leading-none">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel && <span className="mt-1 text-[10px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
