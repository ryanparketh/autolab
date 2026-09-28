import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BookingError, createOnlineBooking } from "@/lib/bookings";
import { createBookingSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid booking", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }
  // Honeypot tripped: pretend success, do nothing.
  if (parsed.data.website) return NextResponse.json({ redirectUrl: "/book/success" });

  try {
    const { redirectUrl } = await createOnlineBooking({
      ...parsed.data,
      vehicle: { ...parsed.data.vehicle, color: parsed.data.vehicle.color || undefined },
    });
    return NextResponse.json({ redirectUrl });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/bookings]", err);
    return NextResponse.json({ error: "Something went wrong. Please call us to book." }, { status: 500 });
  }
}
