import Link from "next/link";
import { cn } from "@/lib/cn";

const pill = "rounded-full px-5 py-2.5 text-sm font-medium transition-colors";

/**
 * Top of the sign-in page: which of the two account journeys you are on. The choice between a
 * client and a professional account belongs to the sign-up page, so it is not repeated here.
 */
export function AccountSwitch({ locale, labels }: { locale: string; labels: { signIn: string; create: string } }) {
  return (
    <nav aria-label={labels.signIn} className="inline-flex w-fit rounded-full border border-line p-1">
      <span aria-current="page" className={cn(pill, "bg-ink text-ground")}>
        {labels.signIn}
      </span>
      <Link href={`/${locale}/auth/sign-up`} className={cn(pill, "text-ink-2 hover:text-ink")}>
        {labels.create}
      </Link>
    </nav>
  );
}
