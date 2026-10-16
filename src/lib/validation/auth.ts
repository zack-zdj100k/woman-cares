import { z } from "zod";
import { categorySlugs } from "@/config/categories";
import { passwordProblem } from "@/lib/auth/password";

/** Normalises Algerian phone numbers to +213XXXXXXXXX; accepts 0XXXXXXXXX, +213…, 00213…, with spaces/dots/dashes. */
export function normalizeDzPhone(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, "");
  const m = digits.match(/^(?:\+213|00213|0)([2-7]\d{7,8})$/);
  return m ? `+213${m[1]}` : null;
}

const email = z.string().trim().toLowerCase().email().max(200);
const fullName = z.string().trim().min(2).max(120);
const phone = z.string().trim().transform((v, ctx) => {
  const n = normalizeDzPhone(v);
  if (!n) ctx.addIssue({ code: "custom", message: "phone" });
  return n ?? "";
});
const terms = z.literal("on");

/** Length and character rules run on the field itself, so they show together with other field errors. */
const newPassword = z.string().superRefine((v, ctx) => {
  const problem = passwordProblem(v);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

/** The "password must not contain the email" rule needs both fields, so it runs once the object is valid. */
function withPassword<T extends { email: string; password: string }>(schema: z.ZodType<T>) {
  return schema.superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, v.email);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  });
}

export const clientSignUpSchema = withPassword(
  z.object({
    fullName,
    email,
    phone,
    password: newPassword,
    preferredWilaya: z.coerce.number().int().min(1).max(58).optional().catch(undefined),
    terms,
  }),
);

export const providerSignUpSchema = withPassword(
  z.object({
    fullName,
    businessName: z.string().trim().min(2).max(120),
    email,
    phone,
    password: newPassword,
    wilaya: z.coerce.number().int().min(1).max(58),
    commune: z.string().trim().max(80).optional(),
    workplaceType: z.enum(["SALON", "STUDIO", "HOME", "MOBILE"]),
    categories: z.array(z.enum(categorySlugs)).min(1).max(categorySlugs.length),
    terms,
  }),
);

export const signInSchema = z.object({ email, password: z.string().min(1).max(200) });
export const emailOnlySchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20).max(100), password: z.string().max(200) });

export type ClientSignUp = z.infer<typeof clientSignUpSchema>;
export type ProviderSignUp = z.infer<typeof providerSignUpSchema>;

/** Field names with an error, for form display. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
