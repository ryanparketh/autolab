import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-x grid flex-1 place-items-center py-24 text-center">
      <div>
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-muted">That page doesn&apos;t exist or has moved.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </main>
  );
}
