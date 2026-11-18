import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSalon } from "@/lib/catalog";
import { adminLocale } from "@/lib/admin";
import { getDictionary } from "@/i18n/dictionaries";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/admin");
  const [salon, locale] = await Promise.all([getSalon(), adminLocale()]);
  const t = getDictionary(locale).admin.login;
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="font-display text-4xl tracking-[0.04em]">{salon.name}</p>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-dark">{t.title}</p>
          <p className="mt-2 text-sm text-mocha">{t.subtitle}</p>
        </div>
        <div className="card mt-8 p-7 sm:p-9">
          <LoginForm t={t} />
        </div>
        <p className="mt-8 text-center text-xs text-taupe">Website by YD Agency</p>
      </div>
    </div>
  );
}
