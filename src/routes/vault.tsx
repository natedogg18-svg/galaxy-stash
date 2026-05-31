import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Orbit, Plus, Eye, EyeOff, Copy, Trash2, LogOut, Search, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Constellation } from "@/components/Constellation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { BackupDialog } from "@/components/BackupDialog";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Vault — Nebula Vault" },
      { name: "description", content: "Your private constellation of saved credentials." },
    ],
  }),
  component: Vault,
});

type Entry = {
  id: string;
  website: string;
  username: string;
  password: string;
  created_at: string;
};

const entrySchema = z.object({
  website: z.string().trim().min(1, "Website required").max(200),
  username: z.string().trim().min(1, "Username required").max(200),
  password: z.string().min(1, "Password required").max(500),
});

function Vault() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [website, setWebsite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else {
        setReady(true);
        load();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("vault_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEntries(data as Entry[]);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = entrySchema.safeParse({ website, username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return;
    const { error } = await supabase.from("vault_entries").insert({
      ...parsed.data,
      user_id: session.user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Star added to your constellation");
    setWebsite(""); setUsername(""); setPassword(""); setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vault_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((e) => e.filter((x) => x.id !== id));
    toast.success("Entry removed");
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const filtered = entries.filter(
    (e) =>
      e.website.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase())
  );

  if (!ready) return <div className="min-h-screen" />;

  return (
    <>
      <Constellation />
      <main className="min-h-screen px-4 py-8 md:px-8">
        <header className="mx-auto max-w-5xl flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Orbit className="h-6 w-6 text-primary" />
            <span className="font-semibold text-gradient-aurora text-lg">Nebula Vault</span>
          </div>
          <div className="flex items-center gap-2">
            <BackupDialog entries={entries} onImported={load} />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </header>

        <section className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your stars..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-aurora text-primary-foreground border-0 glow">
                  <Plus className="h-4 w-4 mr-2" /> Add entry
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>New constellation</DialogTitle>
                </DialogHeader>
                <form onSubmit={add} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" placeholder="example.com"
                      value={website} onChange={(e) => setWebsite(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" placeholder="you@example.com"
                      value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw">Password</Label>
                    <Input id="pw" type="text" placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}
                      className="bg-aurora text-primary-foreground border-0">
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Orbit className="h-10 w-10 mx-auto text-primary mb-3 float" />
              <h2 className="text-lg font-semibold">Your sky is empty</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {entries.length === 0
                  ? "Add your first credential to light up the constellation."
                  : "No entries match your search."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((e) => (
                <li key={e.id} className="glass rounded-xl p-5 group hover:glow transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-aurora flex items-center justify-center shrink-0">
                        <Globe className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{e.website}</h3>
                        <p className="text-xs text-muted-foreground truncate">{e.username}</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}
                      aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono px-3 py-2 rounded-md bg-input/60 truncate">
                      {revealed[e.id] ? e.password : "•".repeat(Math.min(e.password.length, 12))}
                    </code>
                    <Button size="icon" variant="ghost"
                      onClick={() => setRevealed((r) => ({ ...r, [e.id]: !r[e.id] }))}
                      aria-label="Toggle reveal">
                      {revealed[e.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost"
                      onClick={() => copy(e.password, "Password")} aria-label="Copy password">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button onClick={() => copy(e.username, "Username")}
                      className="text-xs text-muted-foreground hover:text-foreground">
                      Copy username
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
