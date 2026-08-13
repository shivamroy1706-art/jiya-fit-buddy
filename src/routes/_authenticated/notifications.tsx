import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AI Fitness Trainer" },
      { name: "description", content: "Reminders, streak alerts and friend activity from your fitness coach." },
      { property: "og:title", content: "Notifications" },
      { property: "og:description", content: "Reminders, streak alerts and friend activity." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, kind, read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    void refetch();
  }

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Notifications" back showJiya={false} />
      <div className="space-y-3 px-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 size-5 text-primary" />
            You're all caught up.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-semibold text-primary"
            >
              Mark all as read
            </button>
            <ul className="space-y-2">
              {data!.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-2xl border p-3 ${n.read ? "border-border bg-surface" : "border-primary/40 bg-primary/5"}`}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
