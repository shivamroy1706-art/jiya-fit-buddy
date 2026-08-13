import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Loader2, LogOut, RefreshCw, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { useAuth } from "@/lib/auth";
import { levelFromXp } from "@/lib/personalization";
import { regeneratePlan } from "@/lib/plan";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — AI Fitness Trainer" },
      {
        name: "description",
        content: "Manage your profile, level and badges, add friends and compare on the leaderboard.",
      },
      { property: "og:title", content: "Your Profile" },
      { property: "og:description", content: "Level, badges, friends and leaderboard." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const [profile, achievements, leaderboard, requests] = await Promise.all([
        supabase.from("profiles").select("name, username, xp, streak_days, avatar_url").eq("id", user!.id).maybeSingle(),
        supabase.from("achievements").select("id, badge_type, label, earned_at").eq("user_id", user!.id),
        supabase.rpc("friends_leaderboard"),
        supabase.from("friend_requests").select("id, from_user, status").eq("to_user", user!.id).eq("status", "pending"),
      ]);
      return {
        profile: profile.data,
        achievements: achievements.data ?? [],
        leaderboard: leaderboard.data ?? [],
        requests: requests.data ?? [],
      };
    },
    enabled: !!user,
  });

  const { data: results } = useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      const { data } = await supabase.rpc("search_users", { _q: query });
      return data ?? [];
    },
    enabled: query.trim().length >= 2,
  });

  const xp = data?.profile?.xp ?? 0;
  const level = levelFromXp(xp);

  async function regenerate() {
    if (!user) return;
    setBusy(true);
    try {
      await regeneratePlan(user.id);
      toast.success("Plan regenerated for your current profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate plan");
    } finally {
      setBusy(false);
    }
  }

  async function addFriend(id: string) {
    if (!user) return;
    const { error } = await supabase.from("friend_requests").insert({ from_user: user.id, to_user: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Friend request sent");
  }

  async function accept(requestId: string) {
    const { error } = await supabase.rpc("accept_friend_request", { _request_id: requestId });
    if (error) {
      toast.error(error.message);
      return;
    }
    void refetch();
  }

  return (
    <main className="app-shell bg-background pb-28">
      <AppHeader title="Profile" />
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <section className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 font-display text-xl font-bold text-primary">
              {(data?.profile?.name ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold">{data?.profile?.name}</p>
              <p className="text-xs text-muted-foreground">@{data?.profile?.username}</p>
              <p className="mt-1 text-xs font-semibold text-primary">
                Lvl {level.level} · {level.title} · {xp} XP
              </p>
            </div>
          </section>

          <section className="flex gap-2">
            <Link
              to="/onboarding"
              className="flex-1 rounded-full border border-border bg-surface py-2.5 text-center text-xs font-semibold"
            >
              Edit answers
            </Link>
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> Regenerate plan
            </button>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Award className="size-4 text-primary" /> Badges
            </h2>
            {(data?.achievements ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Complete workouts to earn your first badge.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {data!.achievements.map((a) => (
                  <li key={a.id} className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-medium">
                    {a.label || a.badge_type}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(data?.requests ?? []).length > 0 && (
            <section className="rounded-3xl border border-primary/40 bg-primary/5 p-4">
              <h2 className="text-sm font-semibold">Friend requests</h2>
              <ul className="mt-2 space-y-2">
                {data!.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-xs text-muted-foreground">Pending request</span>
                    <button
                      type="button"
                      onClick={() => void accept(r.id)}
                      className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    >
                      Accept
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="size-4 text-primary" /> Friends leaderboard
            </h2>
            {(data?.leaderboard ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Add friends to compare streaks and XP.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {data!.leaderboard.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-surface-alt p-2.5">
                    <span className="font-display text-sm font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.xp} XP · {f.streak_days}d
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <UserPlus className="size-4 text-primary" /> Find friends
            </h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username"
              className="mt-3 w-full rounded-full border border-border bg-surface-alt px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <ul className="mt-2 space-y-2">
              {(results ?? [])
                .filter((r) => r.id !== user?.id)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface-alt p-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.name} <span className="text-xs text-muted-foreground">@{r.username}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void addFriend(r.id)}
                      className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      Add
                    </button>
                  </li>
                ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
