import { adminContext } from "@/lib/admin";
import { can } from "@/lib/auth";
import { Sidebar, type NavItem } from "@/components/admin/Sidebar";
import { logoutAction } from "../login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, salon, locale, t } = await adminContext();
  const n = t.nav;
  const items: NavItem[] = [
    { href: "/admin", label: n.overview, icon: "LayoutDashboard" },
    { href: "/admin/calendar", label: n.calendar, icon: "CalendarDays" },
    { href: "/admin/appointments", label: n.appointments, icon: "ListChecks" },
  ];
  if (can.manageAllAppointments(user)) items.push({ href: "/admin/customers", label: n.customers, icon: "Contact" });
  if (can.manageCatalog(user)) {
    items.push(
      { href: "/admin/staff", label: n.staff, icon: "Users" },
      { href: "/admin/services", label: n.services, icon: "Scissors" },
      { href: "/admin/branches", label: n.branches, icon: "Store" },
      { href: "/admin/content", label: n.content, icon: "ImageIcon" },
      { href: "/admin/notifications", label: n.notifications, icon: "BellRing" },
    );
  }
  if (can.manageSettings(user)) items.push({ href: "/admin/settings", label: n.settings, icon: "Settings" });

  return (
    <div className="min-h-dvh">
      <Sidebar
        items={items}
        salonName={salon.name}
        userName={user.full_name}
        roleLabel={t.roles[user.role]}
        locale={locale}
        logoutLabel={n.logout}
        viewSiteLabel={n.viewSite}
        logoutAction={logoutAction}
      />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}
