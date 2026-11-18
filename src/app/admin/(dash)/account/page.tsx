import { adminContext } from "@/lib/admin";
import { PageHeader, Panel, Flash, Field } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { changePasswordAction } from "../settings/actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { user, t } = await adminContext();
  const ts = t.settings;
  return (
    <>
      <PageHeader title={user.full_name} subtitle={`${user.email} · ${t.roles[user.role]}`} />
      <Flash saved={sp.saved} error={sp.error ? (sp.error === "short" ? ts.newPassword : t.login.invalid) : undefined} savedText={ts.passwordChanged} />
      <Panel title={ts.changePassword} className="max-w-md">
        <form action={changePasswordAction} className="space-y-3">
          <Field label={ts.currentPassword}><input type="password" name="current" required autoComplete="current-password" className="input-sm" /></Field>
          <Field label={ts.newPassword}><input type="password" name="next" required minLength={10} autoComplete="new-password" className="input-sm" /></Field>
          <SubmitButton>{t.common.save}</SubmitButton>
        </form>
      </Panel>
    </>
  );
}
