import Link from "next/link";
import { Logo } from "./Logo";
import { categoryMeta, site } from "@/config/site";

export function SiteFooter() {
  const a = site.address;
  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">{site.tagline}.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Services</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {Object.values(categoryMeta).map((c) => (
              <li key={c.slug}>
                <Link href={`/services/${c.slug}`} className="hover:text-ink">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Visit</h3>
          <address className="mt-3 space-y-1 text-sm not-italic text-muted">
            <p>{a.street}</p>
            <p>
              {a.city}, {a.region} {a.postalCode}
            </p>
            <p className="pt-2">
              <a href={site.phoneHref} className="hover:text-ink">
                {site.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className="hover:text-ink">
                {site.email}
              </a>
            </p>
          </address>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/book" className="hover:text-ink">
                Book online
              </Link>
            </li>
            <li>
              <Link href="/quote" className="hover:text-ink">
                Request a quote
              </Link>
            </li>
            <li>
              <Link href="/policies" className="hover:text-ink">
                Booking & privacy policy
              </Link>
            </li>
            <li>
              <a href={site.instagram} className="hover:text-ink" rel="noopener" target="_blank">
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-x py-5 text-xs text-subtle">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
