import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ActionForm } from "../../ActionForm";
import { addClosedDateAction, removeClosedDateAction, settingsAction } from "../../actions";
import { PageTitle } from "../../ui";

export const metadata = { title: "Hours & capacity" };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function SettingsPage() {
  const today = DateTime.now().setZone(env.timezone).toISODate()!;
  const [settings, hours, closed] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.businessHours.findMany({ orderBy: { weekday: "asc" } }),
    db.closedDate.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);
  const s = settings ?? { bayCount: 2, slotIntervalMin: 30, minLeadHours: 12, bookingWindowDays: 60 };

  return (
    <>
      <PageTitle title="Hours & capacity" />
      <p className="-mt-4 mb-8 text-sm text-muted">Shop timezone: {env.timezone}</p>

      <div className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
        <ActionForm action={settingsAction} className="space-y-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">Capacity</h2>
            <div>
              <label className="label">Bays (jobs at the same time)</label>
              <input name="bayCount" type="number" min={1} max={50} defaultValue={s.bayCount} className="input" />
            </div>
            <div>
              <label className="label">Slot interval</label>
              <select name="slotIntervalMin" defaultValue={s.slotIntervalMin} className="input">
                <option value={15}>Every 15 min</option>
                <option value={30}>Every 30 min</option>
                <option value={60}>Every hour</option>
              </select>
            </div>
            <div>
              <label className="label">Minimum notice (hours)</label>
              <input name="minLeadHours" type="number" min={0} defaultValue={s.minLeadHours} className="input" />
            </div>
            <div>
              <label className="label">Book up to (days ahead)</label>
              <input
                name="bookingWindowDays"
                type="number"
                min={1}
                max={365}
                defaultValue={s.bookingWindowDays}
                className="input"
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Weekly hours</h2>
            <div className="space-y-3">
              {DAYS.map((d, i) => {
                const h = hours.find((x) => x.weekday === i + 1);
                return (
                  <div key={d} className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-3 text-sm">
                    <span>{d}</span>
                    <label className="flex items-center gap-1.5 text-muted">
                      <input type="checkbox" name={`open_${i + 1}`} defaultChecked={h?.isOpen ?? false} /> Open
                    </label>
                    <input
                      type="time"
                      name={`from_${i + 1}`}
                      defaultValue={hhmm(h?.openMinute ?? 480)}
                      step={900}
                      className="input"
                      aria-label={`${d} opens`}
                    />
                    <input
                      type="time"
                      name={`to_${i + 1}`}
                      defaultValue={hhmm(h?.closeMinute ?? 1080)}
                      step={900}
                      className="input"
                      aria-label={`${d} closes`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
          <button className="btn btn-primary">Save settings</button>
        </ActionForm>

        <section className="card h-fit p-5">
          <h2 className="font-semibold">Closed dates</h2>
          <p className="mt-1 text-sm text-muted">
            Holidays, vacations, training days. Customers can&apos;t book these.
          </p>
          <ActionForm action={addClosedDateAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="date" name="date" min={today} required className="input" aria-label="Date" />
            <input name="reason" placeholder="Reason (optional)" className="input" aria-label="Reason" />
            <button className="btn btn-ghost !py-2">Add</button>
          </ActionForm>
          <ul className="mt-4 divide-y divide-line text-sm">
            {closed.length === 0 && <li className="py-2 text-subtle">None scheduled.</li>}
            {closed.map((c) => (
              <li key={c.date} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {DateTime.fromISO(c.date).toFormat("ccc, LLL d yyyy")}
                  {c.reason && <span className="text-muted"> · {c.reason}</span>}
                </span>
                <ActionForm action={removeClosedDateAction}>
                  <input type="hidden" name="date" value={c.date} />
                  <button className="text-xs text-danger hover:underline">Remove</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
