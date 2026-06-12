import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `You are the Sandstone School AI Assistant for the Sandstone School of Languages & Computer Studies management platform.
Help staff use the platform: Students, Admissions, Payments & Finance, Accounts, Reports, Marks Entry, Attendance, Graduates, Subscriptions, and Staff Accounts.

Key facts:
- Courses & first-month fees (UGX): English 130,000 (7 levels: Zero, Pre, Level 1-5), Computer 150,000, Swahili 300,000, French 150,000.
- Every new student pays a one-time mandatory registration fee of UGX 20,000 in their first month.
- Marks Entry tracks 8 weekly assessments and computes an average + grade (A-F).
- Roles: Admin, Accountant, Marks Officer, Receptionist.

Be concise, friendly, and step-by-step. If asked about something outside the platform, gently steer back.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
