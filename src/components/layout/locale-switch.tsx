"use client";

import { Suspense, type ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeLabel, type Locale } from "@/i18n/config";

type Props = Omit<ComponentProps<typeof Link>, "href" | "children"> & { target: Locale };

function SamePageLink({ target, ...props }: Props) {
  const pathname = usePathname();
  const href = pathname.replace(/^\/(fr|ar)(?=\/|$)/, `/${target}`) || `/${target}`;
  return (
    <Link href={href} hrefLang={target} lang={target} {...props}>
      {localeLabel[target]}
    </Link>
  );
}

/**
 * Link to the same page in the other language. The current path is only known at request
 * time, so it streams in; until then the link points to the other language's homepage.
 */
export function LocaleSwitch(props: Props) {
  return (
    <Suspense
      fallback={
        <Link href={`/${props.target}`} hrefLang={props.target} lang={props.target} className={props.className} aria-label={props["aria-label"]}>
          {localeLabel[props.target]}
        </Link>
      }
    >
      <SamePageLink {...props} />
    </Suspense>
  );
}
