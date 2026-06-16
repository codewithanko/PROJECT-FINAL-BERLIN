import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Smart Assistant — Sandstone School" }] }),
  component: AssistantPage,
});

// ── The Brain: Knowledge Base of the Sandstone System ───────────────────────
const KNOWLEDGE_BASE = [
  {
    keywords: ["admit", "admission", "new student", "enroll", "register student", "add student"],
    title: "How to Admit a New Student",
    answer: "To admit a new student, you need to use the Admissions page. This will automatically create their profile and record any initial payments.",
    steps: [
      "Click on 'Admissions' in the left sidebar.",
      "Fill in the student's Full Name and auto-generated Registration No.",
      "Select their Course and Starting Level.",
      "Enter any amount paid today (or leave as 0 to record a balance).",
      "Click 'Admit Student'. They will instantly appear in the Students list!"
    ],
    link: "/admissions",
    linkLabel: "Go to Admissions"
  },
  {
    keywords: ["payment", "pay", "fee", "money", "collect", "receipt", "student payment"],
    title: "How to Record a Student Payment",
    answer: "You can record monthly fee payments or partial payments from the Payments page. The system will automatically update the student's balance and log the income in Accounts.",
    steps: [
      "Navigate to 'Payments & Finance' in the sidebar.",
      "Click the 'Record Student Payment' button.",
      "Use the search bar to find the student by name or Reg No.",
      "Enter the amount paid, select the payment method, and click 'Record Payment'.",
      "The student's balance will automatically update!"
    ],
    link: "/payments",
    linkLabel: "Go to Payments"
  },
  {
    keywords: ["other income", "donation", "non-student", "event income", "miscellaneous"],
    title: "How to Record Other Income",
    answer: "If the school receives money from sources other than student fees (like donations or event sales), you can record it in the Payments page under the 'Other Income' tab.",
    steps: [
      "Go to 'Payments & Finance' and click 'Record Other Income'.",
      "Type the Source (e.g., 'Old Boys Donation').",
      "Enter the Amount, Date, and Method.",
      "Click 'Record Income'. It will instantly reflect in your Accounts and Reports!"
    ],
    link: "/payments",
    linkLabel: "Go to Payments"
  },
  {
    keywords: ["staff", "payroll", "salary", "teacher", "advance", "recruit", "hire", "employee"],
    title: "How to Manage Staff & Payroll",
    answer: "The Staff Management page handles everything from recruiting new teachers to processing weekly/monthly payroll and tracking advances.",
    steps: [
      "Click 'Staff Management' in the sidebar.",
      "To add someone, click 'Recruit Staff' and fill in their details.",
      "To process payroll, select the current Week or Month, and click 'Approve' next to their name.",
      "If they need an emergency advance, click the '+' next to their Advances column."
    ],
    link: "/staff-management",
    linkLabel: "Go to Staff Management"
  },
  {
    keywords: ["attendance", "present", "absent", "late", "mark attendance", "performance"],
    title: "How to Mark Staff Attendance",
    answer: "You can track daily staff attendance and rate their performance (1-5 stars) from the Performance tab in Staff Management.",
    steps: [
      "Go to 'Staff Management' and click the 'Performance & Attendance' tab.",
      "Select today's date using the date picker.",
      "For each staff member, select their Status (Present, Absent, Late) and give a Performance Rating.",
      "Click 'Save' on their row. The row will turn green when saved."
    ],
    link: "/staff-management",
    linkLabel: "Go to Staff Management"
  },
  {
    keywords: ["budget", "expense", "planning", "weekly budget", "accounts", "ledger", "transaction"],
    title: "How to Manage Budgets & Expenses",
    answer: "The Accounts page allows you to record manual expenses, plan weekly budgets, and track the school's overall financial health.",
    steps: [
      "Navigate to 'Accounts' in the sidebar.",
      "To record an expense, use the 'Record Manual Transaction' form.",
      "To plan for the week, click the 'Weekly Budget' tab and add expected expenses.",
      "When the week is over, click 'Finalize & Lock Week' to preserve the records."
    ],
    link: "/accounts",
    linkLabel: "Go to Accounts"
  },
  {
    keywords: ["report", "analytics", "export", "word", "docx", "summary", "finance report"],
    title: "How to Generate and Export Reports",
    answer: "The Reports page generates visual charts and an Executive Weekly Summary. You can export everything to a professional Word document.",
    steps: [
      "Click on 'Reports' in the sidebar.",
      "Select the type of report you want (Student, Finance, Staff, etc.).",
      "Review the charts and the auto-generated Executive Summary at the top.",
      "Click the 'Export to Word (.doc)' button to download a formatted report for the board."
    ],
    link: "/reports",
    linkLabel: "Go to Reports"
  },
  {
    keywords: ["message", "communicate", "inbox", "send", "memo", "internal"],
    title: "How to Send Internal Messages",
    answer: "The Communications page is a secure, private messaging system for staff to send approvals, notes, or memos to specific roles (like Admin or Accountant).",
    steps: [
      "Click 'Communications' in the sidebar.",
      "Go to the 'Compose Message' tab.",
      "Select who to send it to (e.g., Admin, All Staff).",
      "Write your subject and message, then click 'Send Message'."
    ],
    link: "/communications",
    linkLabel: "Go to Communications"
  },
  {
    keywords: ["password", "change password", "security", "login", "account"],
    title: "How to Change Your Password",
    answer: "For security purposes, you can change your login password at any time from the Settings or your profile dropdown.",
    steps: [
      "Click your Profile/Role name in the top right corner of the screen.",
      "Select 'Change Password' from the dropdown menu.",
      "Enter your new password and save it."
    ],
    link: "/change-password",
    linkLabel: "Change Password"
  },
  {
    keywords: ["search", "find", "global search", "top bar", "student search"],
    title: "How to Use the Global Search",
    answer: "The search bar at the very top of the screen allows you to instantly find any student from anywhere in the app.",
    steps: [
      "Click the search bar at the top of the screen (next to the Sandstone logo).",
      "Start typing the student's name or Registration Number.",
      "A dropdown will appear with matching students.",
      "Click on a student to instantly jump to their profile in the Students page."
    ],
    link: "/students",
    linkLabel: "Go to Students"
  }
];

const SUGGESTIONS = [
  "How do I admit a new student?",
  "How do I record a payment?",
  "How do I manage staff payroll?",
  "How do I export a report?"
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  match?: typeof KNOWLEDGE_BASE[0];
};

function AssistantPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const findBestMatch = (query: string) => {
    const lower = query.toLowerCase();
    let bestMatch = null;
    let maxScore = 0;

    for (const item of KNOWLEDGE_BASE) {
      let score = 0;
      for (const keyword of item.keywords) {
        if (lower.includes(keyword)) {
          score += keyword.length; // Longer keyword matches = higher score
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }
    return bestMatch;
  };

  const submit = (text: string) => {
    const v = text.trim();
    if (!v) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: v };
    const match = findBestMatch(v);
    
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: match 
        ? match.answer 
        : "I'm not exactly sure how to help with that specific question. Try asking about admissions, payments, staff payroll, reports, or budgets!",
      match: match || undefined
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Smart System Assistant</h1>
          <p className="text-sm text-muted-foreground">Your interactive guide to the Sandstone School platform.</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5">
              <Bot className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">How can I help you navigate the system today?</p>
                <p className="text-sm text-muted-foreground">Try asking one of these:</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="text-left text-sm rounded-lg border bg-card px-3 py-2 hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} onNavigate={(path) => navigate({ to: path })} />
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="border-t p-3 flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask how to do something... (e.g. 'How do I record an expense?')"
            className="h-11"
            autoFocus
          />
          <Button type="submit" disabled={!input.trim()} size="lg">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

function MessageRow({ message, onNavigate }: { message: ChatMessage, onNavigate: (path: string) => void }) {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={`max-w-[85%] space-y-3`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {!isUser && message.match && (
            <p className="font-semibold text-base mb-1 text-foreground">{message.match.title}</p>
          )}
          {message.text}
        </div>
        
        {/* If the assistant found a guide, show the steps and a navigation button */}
        {!isUser && message.match && (
          <div className="border rounded-xl p-4 bg-card space-y-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step-by-Step Guide</p>
            <ol className="space-y-2">
              {message.match.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Button 
              size="sm" 
              className="w-full mt-2" 
              onClick={() => onNavigate(message.match!.link)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {message.match.linkLabel}
            </Button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}