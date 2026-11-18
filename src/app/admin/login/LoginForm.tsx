"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "./actions";

export function LoginForm({ t }: { t: { email: string; password: string; submit: string; invalid: string; locked: string } }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error === "locked" ? t.locked : t.invalid}
        </p>
      )}
      <div>
        <label htmlFor="email" className="field-label">{t.email}</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">{t.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full py-3.5">
        {pending && <Loader2 className="size-4 animate-spin" />} {t.submit}
      </button>
    </form>
  );
}
