"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { after } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { AccountBlocked, changeMyPassword, updateMyAccount } from "@/server/services/account";
import { deliverPendingEmails } from "@/server/services/outbox";

export type AccountState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: string };

export async function updateAccountAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  try {
    await updateMyAccount(user, { fullName: String(form.get("fullName") ?? ""), phone: String(form.get("phone") ?? ""), locale: String(form.get("locale") ?? "") });
  } catch (e) {
    if (e instanceof AccountBlocked) return { status: "error", code: e.reason };
    throw e;
  }
  refresh();
  return { status: "done", at: Date.now() };
}

export async function changePasswordAction(_p: AccountState, form: FormData): Promise<AccountState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  if (!rateLimit(`password:${user.id}`, 5, 15 * 60_000).ok) return { status: "error", code: "rate" };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    await changeMyPassword(user, String(form.get("current") ?? ""), String(form.get("next") ?? ""), token ? hashToken(token) : null);
  } catch (e) {
    if (e instanceof AccountBlocked) return { status: "error", code: e.reason };
    throw e;
  }
  after(() => deliverPendingEmails().catch(() => {}));
  return { status: "done", at: Date.now() };
}
