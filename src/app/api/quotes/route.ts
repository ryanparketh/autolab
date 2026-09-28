import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyNewQuote } from "@/lib/notify";
import { quoteRequestSchema } from "@/lib/validation";
import { categoryMeta } from "@/config/site";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }
  const { contact, vehicle, category, serviceId, message, website } = parsed.data;
  if (website) return NextResponse.json({ ok: true });

  try {
    const service = serviceId
      ? await db.service.findFirst({ where: { id: serviceId, category }, select: { id: true } })
      : null;

    await db.$transaction(async (tx) => {
      // Don't overwrite an existing customer's details from a public form.
      const customer = await tx.customer.upsert({
        where: { email: contact.email },
        update: {},
        create: contact,
      });
      await tx.quoteRequest.create({
        data: {
          customerId: customer.id,
          category,
          serviceId: service?.id ?? null,
          vehicleYear: vehicle.year,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleSize: vehicle.size,
          message:
            [customer.phone !== contact.phone ? `(Phone given: ${contact.phone})` : null, message || null]
              .filter(Boolean)
              .join("\n") || null,
        },
      });
    });

    await notifyNewQuote({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      category: categoryMeta[category].label,
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      message,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/quotes]", err);
    return NextResponse.json({ error: "Something went wrong. Please call or email us." }, { status: 500 });
  }
}
