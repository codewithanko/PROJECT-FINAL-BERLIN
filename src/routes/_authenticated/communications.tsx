import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/roles";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/communications")({
  head: () => ({ meta: [{ title: "Communications — Sandstone School" }] }),
  component: CommunicationsPage,
});

function CommunicationsPage() {
  const { data: roleInfo } = useCurrentRole();
  const role = roleInfo?.role ?? null;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tab, setTab] = useState("inbox");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user)); }, []);

  const fetchMessages = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`recipient_role.eq.${role},recipient_role.eq.all,sender_role.eq.${role}`)
      .order("created_at", { ascending: false });
    if (!error) setMessages(data || []);
    setLoading(false);
  }, [role]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const sendMessage = async (entry: any) => {
    if (!currentUser) return toast.error("User not authenticated");
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUser.id,
      sender_name: role ? ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role : currentUser.email,
      sender_role: role || "unknown",
      ...entry
    });
    if (error) { toast.error("Failed to send: " + error.message); return false; }
    toast.success("Message sent securely");
    fetchMessages();
    return true;
  };

  // NEW: Delete Message Function (Secured so only the sender can delete)
  const deleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to delete this message? This cannot be undone.")) return;
    
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", currentUser.id); // Security check
      
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    toast.success("Message deleted successfully");
    fetchMessages();
  };

  const inbox = messages.filter(m => m.recipient_role === role || m.recipient_role === 'all');
  const sent = messages.filter(m => m.sender_role === role);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Internal Communications</h1>
        <p className="text-sm text-muted-foreground mt-1">Secure, private messaging for staff approvals, notes, and coordination.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose">Compose Message</TabsTrigger>
          <TabsTrigger value="inbox">Inbox ({inbox.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4"><Send className="h-5 w-5 text-primary" /><h2 className="font-semibold text-lg">Send Secure Message</h2></div>
            <MessageForm onSend={sendMessage} />
          </Card>
        </TabsContent>

        <TabsContent value="inbox">
          <MessageList messages={inbox} loading={loading} type="inbox" currentUser={currentUser} onDelete={deleteMessage} />
        </TabsContent>

        <TabsContent value="sent">
          <MessageList messages={sent} loading={loading} type="sent" currentUser={currentUser} onDelete={deleteMessage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// UPDATED: Added "Clear Draft" button
function MessageForm({ onSend }: { onSend: (m: any) => Promise<boolean> }) {
  const [recipient, setRecipient] = useState("admin");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clearForm = () => {
    setSubject("");
    setBody("");
    setRecipient("admin");
    toast.info("Message draft cleared");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return toast.error("Subject and message body required");
    setSubmitting(true);
    const success = await onSend({ recipient_role: recipient, subject: subject.trim(), body: body.trim() });
    setSubmitting(false);
    if (success) { clearForm(); }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Send To</Label>
          <Select value={recipient} onValueChange={setRecipient}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="accountant">Accountant</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
              <SelectItem value="all">All Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Approval needed for utilities" /></div>
      </div>
      <div className="grid gap-2"><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Type your secure message here..." /></div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={clearForm}>Clear Draft</Button>
        <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Send Message</Button>
      </div>
    </form>
  );
}

// UPDATED: Added Delete button for sender's messages
function MessageList({ messages, loading, type, currentUser, onDelete }: { messages: any[], loading: boolean, type: "inbox" | "sent", currentUser: any, onDelete: (id: string) => void }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (messages.length === 0) return <Card className="p-10 text-center text-muted-foreground">No {type} messages yet.</Card>;

  return (
    <Card className="p-0 overflow-hidden divide-y">
      {messages.map((m) => (
        <div key={m.id} className="p-5 hover:bg-muted/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {type === "inbox" ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">From: {m.sender_name}</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">To: {m.recipient_role}</Badge>
              )}
              <span className="font-semibold text-sm">{m.subject}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
              {/* Only show delete button if the current user is the sender */}
              {m.sender_id === currentUser?.id && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                  onClick={() => onDelete(m.id)}
                  title="Delete message"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap ml-1">{m.body}</p>
        </div>
      ))}
    </Card>
  );
}