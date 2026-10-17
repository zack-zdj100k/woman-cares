import type { Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getMyAccount } from "@/server/services/account";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm, ProfileForm } from "./account-forms";

/** "Mon compte", shared by every area: profile, language and password. */
export async function AccountSettings({ user, locale }: { user: SessionUser; locale: Locale }) {
  const [d, me] = await Promise.all([getDashboardDictionary(locale), getMyAccount(user)]);
  const a = d.account;
  return (
    <div className={pageClass}>
      <PageHeader title={a.title} description={a.description} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{a.profile}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{a.email}</dt>
                <dd className="mt-1 break-all" dir="ltr">
                  {me.email}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{a.role}</dt>
                <dd className="mt-1">{d.shell.roles[me.role]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{a.since}</dt>
                <dd className="mt-1">{formatDate(me.createdAt, locale)}</dd>
              </div>
              {me.lastLoginAt && (
                <div>
                  <dt className="text-muted-foreground">{a.lastLogin}</dt>
                  <dd className="mt-1">{formatDate(me.lastLoginAt, locale, { dateStyle: "medium", timeStyle: "short" })}</dd>
                </div>
              )}
            </dl>
            <ProfileForm values={{ fullName: me.fullName, phone: me.phone ?? "", locale: me.locale }} labels={{ fullName: a.fullName, phone: a.phone, language: a.language, save: a.save, saved: a.saved, errors: a.errors }} />
          </CardContent>
        </Card>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>{a.password}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm labels={{ help: a.passwordHelp, current: a.current, next: a.next, change: a.change, changed: a.changed, errors: a.errors }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
