import type { Locale } from "@/i18n/config";
import type { DashboardDictionary } from "@/i18n/dictionaries/dashboard.fr";
import { formatDate, formatDzd } from "@/lib/format";
import { DeclarePaymentForm } from "@/components/dashboard/billing-forms";
import { Badge } from "@/components/ui/badge";

type Invoice = {
  id: string;
  number: string;
  periodStart: Date;
  periodEnd: Date;
  total: { toString(): string };
  status: string;
  dueAt: Date;
  payments: {
    id: string;
    status: string;
    method: string;
    externalReference: string | null;
    createdAt: Date;
    note: string | null;
    receiptKey?: string | null;
    receiptNote?: string | null;
    coveredFrom?: Date | null;
    coveredTo?: Date | null;
  }[];
};

/** A professional's invoices, each with its payments and, when unpaid, the declaration form. */
export function InvoiceList({ invoices, locale, b, limit }: { invoices: Invoice[]; locale: Locale; b: DashboardDictionary["billing"]; limit?: number }) {
  const rows = limit ? invoices.slice(0, limit) : invoices;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{b.noInvoices}</p>;
  return (
    <ul className="grid gap-3">
      {rows.map((inv) => {
        const pending = inv.payments.find((p) => p.status === "PENDING");
        const unpaid = inv.status === "OPEN" || inv.status === "OVERDUE";
        return (
          <li key={inv.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-medium" dir="ltr">
                {inv.number}
              </span>
              <span className="text-muted-foreground">
                {formatDate(inv.periodStart, locale, { dateStyle: "medium" })} – {formatDate(inv.periodEnd, locale, { dateStyle: "medium" })}
              </span>
              <span className="text-base font-semibold tabular-nums">{formatDzd(inv.total.toString(), locale)}</span>
              <Badge variant={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : inv.status === "VOID" ? "outline" : "warning"}>{b.invoiceStatuses[inv.status]}</Badge>
            </div>
            {unpaid && (
              <p className="mt-2 text-xs text-muted-foreground">
                {b.due} {formatDate(inv.dueAt, locale)}
              </p>
            )}
            {inv.payments.length > 0 && (
              <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                {inv.payments.map((p) => (
                  <li key={p.id}>
                    {formatDate(p.createdAt, locale, { dateStyle: "medium" })} · {b.methods[p.method]} <span dir="ltr">{p.externalReference}</span> ·{" "}
                    <span className={p.status === "PAID" ? "text-success" : p.status === "FAILED" ? "text-destructive" : "text-warning"}>{b.paymentStatuses[p.status]}</span>
                    {p.status === "FAILED" && p.note && <span> · {p.note}</span>}
                    {p.status === "PAID" && (p.receiptKey || p.receiptNote || p.coveredFrom) && (
                      <span className="mt-1.5 block rounded-lg bg-white/[0.04] px-3 py-2 text-foreground">
                        <span className="font-medium">{b.receipt}</span>
                        {p.coveredFrom && p.coveredTo && (
                          <span className="text-muted-foreground"> · {b.coveredRange(formatDate(p.coveredFrom, locale, { dateStyle: "medium" }), formatDate(p.coveredTo, locale, { dateStyle: "medium" }))}</span>
                        )}
                        {p.receiptNote && <span className="mt-0.5 block text-muted-foreground">{p.receiptNote}</span>}
                        {p.receiptKey && (
                          <a href={`/api/v1/billing/payments/${p.id}/receipt`} className="mt-1 inline-block text-chart-1 underline underline-offset-4">
                            {b.downloadReceipt}
                          </a>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {unpaid && (
              <div className="mt-3">
                {pending ? (
                  <p className="text-sm text-warning">{b.pending}</p>
                ) : (
                  <DeclarePaymentForm
                    invoiceId={inv.id}
                    labels={{ declare: b.declare, help: b.declareHelp, method: b.method, reference: b.reference, message: b.message, proof: b.proof, proofHelp: b.proofHelp, send: b.send, done: b.declared, methods: b.methods, errors: b.errors }}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
