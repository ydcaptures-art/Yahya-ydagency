import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { adminPage, adminContext, f } from "@/lib/admin";
import { sql } from "@/lib/db";
import { providerStatus, retryNotification } from "@/lib/notifications";
import { formatDate, formatTime } from "@/lib/time";
import { PageHeader, Panel, Badge, Empty } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

async function retryAction(fd: FormData) {
  "use server";
  const { salon } = await adminContext(["owner", "manager"]);
  await retryNotification(salon, f.str(fd, "id"));
  revalidatePath("/admin/notifications");
}

export default async function NotificationsPage() {
  const { salon, locale, t } = await adminPage(["owner", "manager"]);
  const rows = await sql<{ id: string; appointment_id: string | null; reference: string | null; channel: string; type: string; recipient: string; status: string; error: string | null; created_at: Date }[]>`
    select n.id, n.appointment_id, a.reference, n.channel, n.type, n.recipient, n.status, n.error, n.created_at
    from notifications n left join appointments a on a.id = n.appointment_id
    where n.salon_id = ${salon.id} order by n.created_at desc limit 200`;
  const tn = t.notificationsPage;
  const providers = providerStatus();
  const cronOk = !!process.env.CRON_SECRET && process.env.CRON_SECRET !== "change-me-to-a-long-random-string";
  return (
    <>
      <PageHeader title={tn.title} subtitle={tn.intro} />
      <Panel title={tn.providers} className="mb-6">
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["Email (Resend)", providers.email],
            ["WhatsApp Business (Meta Cloud API)", providers.whatsapp],
            ["Reminder scheduler (CRON_SECRET)", cronOk],
          ].map(([label, ok]) => (
            <li key={String(label)} className="flex items-center gap-2 rounded-xl border border-line p-3">
              {ok ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-taupe" />}
              <span><span className="block font-medium">{label}</span><span className="text-xs text-taupe">{ok ? tn.configured : tn.notConfigured}</span></span>
            </li>
          ))}
        </ul>
      </Panel>
      {rows.length === 0 ? <Empty>{t.common.noResults}</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-porcelain shadow-soft">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-cream/60 text-left text-[11px] uppercase tracking-[0.12em] text-mocha">
              <tr><th className="px-4 py-3">{tn.created}</th><th className="px-4 py-3">{tn.channel}</th><th className="px-4 py-3">{tn.type}</th><th className="px-4 py-3">{tn.recipient}</th><th className="px-4 py-3">{t.common.status}</th><th className="px-4 py-3">{tn.error}</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(n.created_at, locale, salon.timezone, { weekday: undefined, year: undefined, month: "short" })} {formatTime(n.created_at, locale, salon.timezone)}
                    {n.appointment_id && <Link href={`/admin/appointments/${n.appointment_id}`} className="block text-xs text-gold-dark hover:underline">{n.reference}</Link>}</td>
                  <td className="px-4 py-3">{n.channel === "email" ? "Email" : "WhatsApp"}</td>
                  <td className="px-4 py-3">{tn.types[n.type as keyof typeof tn.types]}</td>
                  <td className="px-4 py-3 break-all">{n.recipient}</td>
                  <td className="px-4 py-3"><Badge status={n.status} label={tn.statuses[n.status as keyof typeof tn.statuses]} /></td>
                  <td className="max-w-xs px-4 py-3 text-xs text-taupe">{n.error}</td>
                  <td className="px-4 py-3">{(n.status === "failed" || n.status === "skipped") && (
                    <form action={retryAction}><input type="hidden" name="id" value={n.id} /><SubmitButton className="text-xs font-semibold text-gold-dark hover:underline">{tn.retry}</SubmitButton></form>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
