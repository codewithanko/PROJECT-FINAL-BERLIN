import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </header>
      <div className="rounded-2xl border bg-card p-12 text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-accent flex items-center justify-center text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          This module is wired to the database and will be available shortly. Use the dashboard to track progress.
        </p>
      </div>
    </div>
  );
}
