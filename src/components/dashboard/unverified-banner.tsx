import type { Locale } from "@/i18n/config";
import type { AuthDictionary } from "@/i18n/get-dictionary";
import { ResendVerificationForm } from "@/components/auth/auth-forms";

export function UnverifiedBanner({ locale, t }: { locale: Locale; t: AuthDictionary }) {
  return (
    <div role="status" className="mb-10 flex flex-col gap-3 rounded-(--radius-field) bg-parchment p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="leading-relaxed">{t.account.unverified}</p>
      <ResendVerificationForm locale={locale} copy={t.account} common={t.common} />
    </div>
  );
}
