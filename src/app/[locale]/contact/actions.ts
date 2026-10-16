"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  type: z.enum(["GENERAL", "PROMOTION_REQUEST", "BILLING", "TECHNICAL", "REPORT"]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional(), // honeypot: real people never fill it
});

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      fields?: Partial<Record<"name" | "email" | "subject" | "message", true>>;
      reason?: "rate" | "generic";
      /** Echoed back so the form keeps what was typed (React resets forms after an action). */
      values: Record<"name" | "email" | "type" | "subject" | "message", string>;
    };

/** Stores a support request. Email notification to the team is added with the outbox in Phase 11. */
export async function submitContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const raw = Object.fromEntries(form);
  const text = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).slice(0, 5000) : "");
  const values = { name: text("name"), email: text("email"), type: text("type"), subject: text("subject"), message: text("message") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { status: "sent" }; // silently drop bots
    const fields: Partial<Record<"name" | "email" | "subject" | "message", true>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" || key === "email" || key === "subject" || key === "message") fields[key] = true;
    }
    return { status: "error", fields, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`contact:${ip}`, 5, 15 * 60_000).ok || !rateLimit(`contact:${parsed.data.email}`, 5, 15 * 60_000).ok) {
    return { status: "error", reason: "rate", values };
  }

  try {
    const { name, email, type, subject, message } = parsed.data;
    await db.supportRequest.create({ data: { name, email, type, subject, message } });
    return { status: "sent" };
  } catch {
    return { status: "error", reason: "generic", values };
  }
}
