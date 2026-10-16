"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { markRead } from "@/server/services/notifications";

export async function markReadAction(form: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  await markRead(user, String(form.get("id") ?? "all"));
  refresh();
}
