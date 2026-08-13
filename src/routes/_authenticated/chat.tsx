import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { JiyaAvatar } from "@/components/brand/JiyaAvatar";
import { useAuth } from "@/lib/auth";
import { askJiya } from "@/lib/jiya.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat with Jiya — AI Fitness Trainer" },
      {
        name: "description",
        content: "Ask Jiya, your AI coach, about your plan, nutrition and recovery — she knows your data.",
      },
      { property: "og:title", content: "Jiya, your AI fitness coach" },
      { property: "og:description", content: "Context-aware coaching on your plan, nutrition and recovery." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const send = useServerFn(askJiya);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["chat", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender, message, created_at")
        .eq("user_id", user!.id)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data, pending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setPending(message);
    setBusy(true);
    try {
      await send({ data: { message } });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Jiya couldn't reply. Try again.");
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  return (
    <main className="app-shell flex flex-col bg-background">
      <AppHeader title="Jiya" back showJiya={false} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {(data ?? []).length === 0 && !pending && (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-6 text-center">
                <JiyaAvatar size={56} />
                <p className="font-display text-lg font-bold">Hi, I'm Jiya</p>
                <p className="text-xs text-muted-foreground">
                  Ask me about today's workout, your calorie targets, swapping an exercise, or how to hit your goal
                  faster.
                </p>
              </div>
            )}
            {(data ?? []).map((m) => <Bubble key={m.id} mine={m.sender === "user"} text={m.message} />)}
            {pending && <Bubble mine text={pending} />}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" /> Jiya is typing…
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 flex gap-2 border-t border-border bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Jiya anything…"
          className="flex-1 rounded-full border border-border bg-surface-alt px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label="Send"
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </main>
  );
}

function Bubble({ mine, text }: { mine: boolean; text: string }) {
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <p
        className={
          mine
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-border bg-surface px-3 py-2 text-sm"
        }
      >
        {text}
      </p>
    </div>
  );
}
