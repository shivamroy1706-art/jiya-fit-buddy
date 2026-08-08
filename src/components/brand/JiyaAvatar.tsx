import jiyaAvatar from "@/assets/jiya-avatar.png";
import { cn } from "@/lib/utils";

export const JIYA_AVATAR_SRC = jiyaAvatar;

type Props = {
  size?: number;
  className?: string;
  ring?: boolean;
};

/** The single, consistent Jiya avatar used everywhere in the app. */
export function JiyaAvatar({ size = 40, className, ring = true }: Props) {
  return (
    <img
      src={jiyaAvatar}
      alt="Jiya, your AI fitness coach"
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={cn(
        "shrink-0 rounded-full object-cover",
        ring && "ring-2 ring-primary/70",
        className,
      )}
    />
  );
}
