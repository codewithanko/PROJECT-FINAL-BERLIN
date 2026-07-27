import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Forgot Password — Sandstone School" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Please enter your username");
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("password_reset_requests")
        .insert({ 
          username: username.trim(), 
          message: message.trim() || null,
          status: "pending"
        });
        
      if (error) throw error;
      
      setSubmitted(true);
      toast.success("Request sent to administrator");
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="h-8 w-8" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {!submitted ? (
            <>
              <h1 className="text-2xl font-bold">Forgot your password?</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Enter your username below. Your school administrator will be notified to reset it for you.
              </p>
              <form onSubmit={submit} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="e.g. receptionist1"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Note to admin (optional)</Label>
                  <Textarea
                    id="message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. I forgot my password, please help..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send reset request"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold mt-4">Request received</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Your administrator has been notified. Please contact them directly or wait for them to provide your new temporary password.
              </p>
            </div>
          )}

          <Link
            to="/auth"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}