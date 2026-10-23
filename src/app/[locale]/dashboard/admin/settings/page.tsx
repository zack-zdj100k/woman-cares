import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary, getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { canManageSiteSettings } from "@/server/policies/roles";
import { getTargets, HIGHER_IS_BETTER, TARGET_KEYS } from "@/server/services/targets";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { TargetsForm } from "@/components/admin/targets-form";
import { PaymentDetailsForm } from "@/components/admin/payment-details-form";
import { PublisherForm } from "@/components/admin/publisher-form";
import { formatDate } from "@/lib/format";
import { formatRip } from "@/lib/payment-details";
import { getPaymentDetails, getPublisherForEditing } from "@/server/services/site-settings";
import { getFreeTrialForAll } from "@/server/services/billing";
import { FreeTrialSwitch } from "@/components/dashboard/billing-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.settings.title, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/admin/settings">) {
  return <Settings params={params} />;
}

async function Settings({ params }: { params: PageProps<"/[locale]/dashboard/admin/settings">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/settings`);
  if (!canManageSiteSettings(user)) notFound();
  const [at, d, targets, payment, publisher, freeTrial] = await Promise.all([getAdminDictionary(locale), getDashboardDictionary(locale), getTargets(), getPaymentDetails(user), getPublisherForEditing(user), getFreeTrialForAll(user)]);
  const s = at.settings;
  return (
    <div className={pageClass}>
      <PageHeader title={s.title} description={s.intro} />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{d.billing.freeTrialAll.title}</CardTitle>
          <CardDescription>{freeTrial ? d.billing.freeTrialAll.on : d.billing.freeTrialAll.off}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!freeTrial && <p className="text-xs text-muted-foreground">{d.billing.freeTrialAll.resumeHelp}</p>}
          <FreeTrialSwitch
            on={freeTrial}
            locale={locale}
            labels={{ stop: d.billing.freeTrialAll.stop, stopConfirm: d.billing.freeTrialAll.stopConfirm, cancel: d.billing.trialBlock.cancel, resume: d.billing.freeTrialAll.resume, errors: d.billing.errors }}
          />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{s.payment.title}</CardTitle>
          <CardDescription>{s.payment.hint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {payment.status === "tampered" && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              {s.payment.tampered}
            </p>
          )}
          {payment.status === "none" && <p className="text-sm text-muted-foreground">{s.payment.none}</p>}
          {payment.status === "ok" && (
            <p className="text-sm text-muted-foreground">
              {s.payment.updated} : {formatDate(payment.updatedAt, locale, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          <PaymentDetailsForm
            holder={payment.status === "ok" ? payment.holder : ""}
            rip={payment.status === "ok" ? formatRip(payment.rip) : ""}
            labels={{ holder: s.payment.holder, rip: s.payment.rip, ripHint: s.payment.ripHint, password: s.payment.password, passwordHint: s.payment.passwordHint, save: s.payment.save, saved: s.payment.saved, errors: s.payment.errors }}
          />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{s.publisher.title}</CardTitle>
          <CardDescription>{s.publisher.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <PublisherForm
            values={publisher}
            labels={{ name: s.publisher.name, rc: s.publisher.rc, nif: s.publisher.nif, address: s.publisher.address, phone: s.publisher.phone, email: s.publisher.email, save: s.publisher.save, saved: s.publisher.saved, errors: s.publisher.errors }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{s.targets}</CardTitle>
          <CardDescription>{s.targetsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <TargetsForm
            rows={TARGET_KEYS.map((k) => ({
              key: k,
              label: d.analytics.rates[k],
              hint: d.analytics.ratesHint[k],
              value: targets[k] === null ? "" : String(Math.round(targets[k]! * 10_000) / 100),
              higher: HIGHER_IS_BETTER[k],
            }))}
            labels={{ min: s.min, max: s.max, save: s.save, saved: s.saved, errors: s.errors }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
