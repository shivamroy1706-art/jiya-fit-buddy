import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Bell } from "lucide-react";
import { JiyaAvatar } from "@/components/brand/JiyaAvatar";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  showJiya?: boolean;
  showBell?: boolean;
  unread?: number;
  className?: string;
};

export function AppHeader({
  title,
  back = false,
  right,
  showJiya = true,
  showBell = false,
  unread = 0,
  className,
}: Props) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur",
        className,
      )}
    >
      {back && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.history.back()}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground active:bg-surface-alt"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {title && <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>}
      {!title && <span className="flex-1" />}
      {right}
      {showBell && (
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      )}
      {showJiya && (
        <Link
          to="/chat"
          data-tour="jiya-chat"
          aria-label="Chat with Jiya, your AI coach"
          className="flex items-center gap-2 rounded-full border border-primary/40 bg-surface py-1 pl-1 pr-3 text-xs font-semibold text-primary"
        >
          <JiyaAvatar size={26} ring={false} />
          AI Assistant
        </Link>
      )}
    </header>
  );
}
