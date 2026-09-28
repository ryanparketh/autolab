import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../actions";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  await requireAdmin();
  const [newQuotes, pending] = await Promise.all([
    db.quoteRequest.count({ where: { status: "NEW" } }),
    db.booking.count({ where: { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } } }),
  ]);

  const nav = [
    { href: "/admin", label: "Bookings", badge: pending },
    { href: "/admin/bookings/new", label: "New booking" },
    { href: "/admin/quotes", label: "Quote requests", badge: newQuotes },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/services", label: "Services & prices" },
    { href: "/admin/settings", label: "Hours & capacity" },
  ];

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface/60 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between p-5 md:block">
          <Link href="/admin">
            <Logo className="text-sm" />
          </Link>
          <p className="hidden pt-1 font-mono text-[10px] tracking-widest text-subtle md:block">SHOP ADMIN</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3" aria-label="Admin">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
            >
              {n.label}
              {!!n.badge && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-ink">
                  {n.badge}
                </span>
              )}
            </Link>
          ))}
          <div className="my-2 hidden border-t border-line md:block" />
          <Link href="/" target="_blank" className="shrink-0 rounded-lg px-3 py-2 text-sm text-subtle hover:text-ink">
            View site ↗
          </Link>
          <form action={logoutAction}>
            <button className="w-full shrink-0 rounded-lg px-3 py-2 text-left text-sm text-subtle hover:text-ink">
              Sign out
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
