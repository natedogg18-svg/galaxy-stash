import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Lock, Shield, Orbit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Constellation } from "@/components/Constellation";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nebula Vault — Password Manager Among the Stars" },
      { name: "description", content: "A constellation-themed password manager. Store your credentials safely in your own private galaxy." },
      { property: "og:title", content: "Nebula Vault" },
      { property: "og:description", content: "A constellation-themed password manager." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/vault" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return <div className="min-h-screen" />;

  return (
    <>
      <Constellation />
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="float mb-8 inline-flex items-center justify-center rounded-full glass p-5 glow">
          <Orbit className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          <span className="text-gradient-aurora">Nebula Vault</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Your passwords, charted across the cosmos. Login once, navigate your
          private constellation of credentials.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-aurora text-primary-foreground glow border-0">
            <Link to="/auth">Enter the vault</Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3 max-w-4xl w-full">
          {[
            { icon: Shield, title: "Private orbit", text: "Only you can see your entries — row-level security on every star." },
            { icon: Lock, title: "Quick reveal", text: "Tap to unmask passwords and copy them to your clipboard." },
            { icon: Sparkles, title: "Made of light", text: "A living constellation reacts to your every move." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-xl p-6 text-left">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
