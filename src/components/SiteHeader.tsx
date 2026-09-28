"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { site } from "@/config/site";

const nav = [
  { href: "/services/ppf", label: "PPF" },
  { href: "/services/ceramic-coating", label: "Ceramic" },
  { href: "/services/window-tint", label: "Tint" },
  { href: "/services/detailing", label: "Detailing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" aria-label={`${site.name} home`}>
          <Logo className="text-base" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-sm transition-colors hover:text-ink ${pathname === n.href ? "text-ink" : "text-muted"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/book" className="btn btn-primary hidden !py-2 sm:inline-flex">
            Book now
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-bg md:hidden" aria-label="Mobile">
          <div className="container-x flex flex-col py-3">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="py-3 text-base text-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
            <Link href="/book" className="btn btn-primary mt-3">
              Book now
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
