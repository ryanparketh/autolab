import { DateTime } from "luxon";

const statusStyles: Record<string, string> = {
  PENDING_PAYMENT: "bg-warn/15 text-warn",
  CONFIRMED: "bg-accent/15 text-accent",
  IN_PROGRESS: "bg-purple-500/15 text-purple-300",
  COMPLETED: "bg-ok/15 text-ok",
  CANCELLED: "bg-danger/15 text-danger",
  NO_SHOW: "bg-danger/15 text-danger",
  EXPIRED: "bg-line text-subtle",
  NEW: "bg-accent/15 text-accent",
  CONTACTED: "bg-warn/15 text-warn",
  CONVERTED: "bg-ok/15 text-ok",
  CLOSED: "bg-line text-subtle",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusStyles[status] ?? ""}`}
    >
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function fmtLocal(d: Date, tz: string, fmt = "ccc LLL d · h:mm a") {
  return DateTime.fromJSDate(d, { zone: tz }).toFormat(fmt);
}

export const sizeLabel: Record<string, string> = {
  COUPE_SEDAN: "Coupe/Sedan",
  SMALL_SUV: "Small SUV",
  LARGE_SUV_TRUCK: "Large SUV/Truck",
  EXOTIC: "Exotic",
};
