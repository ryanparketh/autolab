// Seeds PLACEHOLDER services, prices, hours and settings. Safe to re-run: it
// only inserts what's missing and never overwrites edits made in /admin.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ServiceCategory, type VehicleSize } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SIZES: VehicleSize[] = ["COUPE_SEDAN", "SMALL_SUV", "LARGE_SUV_TRUCK", "EXOTIC"];

type SeedService = {
  slug: string;
  category: ServiceCategory;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  mode?: "INSTANT" | "QUOTE";
  durationDays?: number;
  startingAt?: number; // dollars
  deposit?: { type: "FLAT" | "PERCENT"; value: number }; // FLAT in dollars
  popular?: boolean;
  /** [dollars, minutes] per size, in SIZES order */
  prices?: Array<[number, number]>;
};

const services: SeedService[] = [
  // ── Detailing ────────────────────────────────────────────────────────────
  {
    slug: "maintenance-wash",
    category: "DETAILING",
    name: "Maintenance Wash",
    tagline: "Safe hand wash for coated and protected cars.",
    description: "A two-bucket, pH-neutral hand wash that keeps coatings and PPF performing like day one.",
    features: [
      "Foam pre-wash",
      "Two-bucket hand wash",
      "Wheel faces & tires",
      "Towel + air dry",
      "Interior vacuum & wipe-down",
    ],
    prices: [
      [60, 90],
      [75, 105],
      [90, 120],
      [125, 150],
    ],
  },
  {
    slug: "interior-detail",
    category: "DETAILING",
    name: "Interior Detail",
    tagline: "Every surface cleaned, steamed and protected.",
    description: "Deep interior reset: extraction, steam, leather care and UV protection for plastics.",
    features: [
      "Full vacuum & air purge",
      "Carpet & upholstery extraction",
      "Leather clean & condition",
      "Steam-cleaned vents & cupholders",
      "Streak-free glass",
    ],
    prices: [
      [175, 180],
      [200, 210],
      [250, 240],
      [300, 300],
    ],
  },
  {
    slug: "full-detail",
    category: "DETAILING",
    name: "Full Detail",
    tagline: "Inside and out. Our most-booked service.",
    description: "Our interior detail plus a full decontamination wash and 6-month sealant on the paint.",
    features: [
      "Everything in Interior Detail",
      "Iron & tar decontamination",
      "Clay bar treatment",
      "6-month paint sealant",
      "Tire dressing & trim restore",
    ],
    popular: true,
    prices: [
      [275, 300],
      [325, 330],
      [375, 390],
      [475, 420],
    ],
  },
  {
    slug: "paint-correction-1-step",
    category: "DETAILING",
    name: "Paint Correction — 1-Step",
    tagline: "Removes light swirls and restores gloss.",
    description:
      "Single-stage machine polish that removes 60–70% of swirls and light scratches. Ideal before a ceramic coating.",
    features: [
      "Full decontamination wash",
      "Paint depth readings",
      "Single-stage machine polish",
      "Panel wipe & inspection",
      "Sealant finish",
    ],
    durationDays: 1,
    prices: [
      [450, 0],
      [550, 0],
      [650, 0],
      [850, 0],
    ],
  },
  {
    slug: "paint-correction-2-step",
    category: "DETAILING",
    name: "Paint Correction — 2-Step",
    tagline: "Heavy defect removal for a near-flawless finish.",
    description: "Compound and polish stages remove 85–95% of visible defects. For dark paint and enthusiasts.",
    features: [
      "Everything in 1-Step",
      "Heavy cut compounding stage",
      "Refining polish stage",
      "Paint depth readings per panel",
      "Before/after photos",
    ],
    durationDays: 2,
    prices: [
      [800, 0],
      [950, 0],
      [1100, 0],
      [1500, 0],
    ],
  },

  // ── Window tint ──────────────────────────────────────────────────────────
  {
    slug: "tint-front-two",
    category: "WINDOW_TINT",
    name: "Front Two Windows",
    tagline: "Match your factory rear privacy glass.",
    description: "Ceramic film on the driver and passenger windows. Blocks heat and 99% of UV.",
    features: [
      "Ceramic IR-rejecting film",
      "Computer-cut patterns",
      "99% UV rejection",
      "Lifetime film warranty (brand TBD)",
    ],
    prices: [
      [150, 90],
      [150, 90],
      [175, 90],
      [200, 120],
    ],
  },
  {
    slug: "tint-full-vehicle",
    category: "WINDOW_TINT",
    name: "Full Vehicle Ceramic Tint",
    tagline: "All side and rear windows. Cooler cabin, more privacy.",
    description: "Premium ceramic film on every side and rear window (windshield sold separately).",
    features: [
      "All side windows + rear glass",
      "High heat rejection",
      "No signal interference",
      "Lifetime film warranty (brand TBD)",
    ],
    popular: true,
    prices: [
      [399, 180],
      [449, 210],
      [499, 240],
      [599, 240],
    ],
  },
  {
    slug: "tint-windshield",
    category: "WINDOW_TINT",
    name: "Windshield (Clear IR)",
    tagline: "Near-clear film that blocks heat, not visibility.",
    description: "Optically clear infrared-rejecting film for the windshield. Legal in most states — check local laws.",
    features: ["70–80% VLT clear ceramic", "Major heat reduction", "Reduces dashboard fading"],
    prices: [
      [250, 90],
      [275, 90],
      [300, 120],
      [350, 120],
    ],
  },
  {
    slug: "tint-sunstrip",
    category: "WINDOW_TINT",
    name: "Windshield Sun Strip",
    tagline: "Cuts glare at the top of the windshield.",
    description: "A tinted band across the top of the windshield, cut to the AS-1 line.",
    features: ["Cut to AS-1 line", "Glare reduction"],
    prices: [
      [60, 30],
      [60, 30],
      [70, 30],
      [80, 30],
    ],
  },

  // ── PPF (quote) ──────────────────────────────────────────────────────────
  {
    slug: "ppf-partial-front",
    category: "PPF",
    name: "Partial Front",
    tagline: "Bumper, partial hood, fenders and mirrors.",
    description: "Protects the highest-impact areas from rock chips. Self-healing, gloss-enhancing film.",
    features: [
      "Front bumper",
      '18–24" of hood & fenders',
      "Mirror caps",
      "Self-healing top coat",
      "10-year film warranty (brand TBD)",
    ],
    mode: "QUOTE",
    durationDays: 1,
    startingAt: 995,
    deposit: { type: "PERCENT", value: 20 },
  },
  {
    slug: "ppf-full-front",
    category: "PPF",
    name: "Full Front",
    tagline: "No visible lines across the front end.",
    description: "Full bumper, full hood, full fenders, mirrors and headlights — wrapped edges where possible.",
    features: [
      "Full hood & fenders",
      "Front bumper & headlights",
      "Mirror caps",
      "Wrapped edges",
      "10-year film warranty (brand TBD)",
    ],
    mode: "QUOTE",
    durationDays: 2,
    startingAt: 1995,
    deposit: { type: "PERCENT", value: 20 },
    popular: true,
  },
  {
    slug: "ppf-track-pack",
    category: "PPF",
    name: "Track Pack",
    tagline: "Full front plus rockers, A-pillars and roofline.",
    description: "Everything in Full Front plus the areas that take a beating on track and highway.",
    features: [
      "Everything in Full Front",
      "Rocker panels",
      "A-pillars & roof leading edge",
      "Rear-quarter impact zones",
    ],
    mode: "QUOTE",
    durationDays: 3,
    startingAt: 2995,
    deposit: { type: "PERCENT", value: 20 },
  },
  {
    slug: "ppf-full-body",
    category: "PPF",
    name: "Full Body",
    tagline: "Every painted panel, gloss or matte.",
    description: "Complete coverage of every painted surface. Available in gloss or stealth (matte) finish.",
    features: ["Every painted panel", "Gloss or matte finish", "Door jambs available", "Includes paint prep"],
    mode: "QUOTE",
    durationDays: 5,
    startingAt: 5995,
    deposit: { type: "PERCENT", value: 20 },
  },

  // ── Ceramic coating (quote) ──────────────────────────────────────────────
  {
    slug: "ceramic-2-year",
    category: "CERAMIC_COATING",
    name: "Essential — 2-Year Coating",
    tagline: "Entry coating with a 1-step polish.",
    description: "1-step paint correction followed by a 2-year professional ceramic coating.",
    features: [
      "Decon wash & clay",
      "1-step paint correction",
      "2-year ceramic coating (brand TBD)",
      "Wheel faces coated",
    ],
    mode: "QUOTE",
    durationDays: 2,
    startingAt: 899,
    deposit: { type: "PERCENT", value: 20 },
  },
  {
    slug: "ceramic-5-year",
    category: "CERAMIC_COATING",
    name: "Signature — 5-Year Coating",
    tagline: "Multi-layer coating for daily drivers.",
    description: "Enhanced correction and a multi-layer 5-year coating on paint, wheels and glass.",
    features: [
      "Enhanced paint correction",
      "5-year ceramic coating (brand TBD)",
      "Wheels & calipers",
      "Glass coating",
      "Plastic trim",
    ],
    mode: "QUOTE",
    durationDays: 3,
    startingAt: 1499,
    deposit: { type: "PERCENT", value: 20 },
    popular: true,
  },
  {
    slug: "ceramic-9-year",
    category: "CERAMIC_COATING",
    name: "Elite — 9-Year Coating",
    tagline: "Our flagship. Maximum gloss and durability.",
    description: "2-step correction and our top-tier coating with an installer-registered warranty.",
    features: [
      "2-step paint correction",
      "9-year ceramic coating (brand TBD)",
      "Wheels-off coating",
      "Glass, trim & interior",
      "Registered warranty",
    ],
    mode: "QUOTE",
    durationDays: 4,
    startingAt: 1999,
    deposit: { type: "PERCENT", value: 20 },
  },
];

const addOns: Array<{
  name: string;
  description: string;
  price: number;
  minutes: number;
  categories: ServiceCategory[];
}> = [
  {
    name: "Engine Bay Detail",
    description: "Degrease, rinse and dress the engine bay.",
    price: 75,
    minutes: 45,
    categories: ["DETAILING"],
  },
  {
    name: "Pet Hair Removal",
    description: "For heavy pet hair in carpets and seats.",
    price: 60,
    minutes: 45,
    categories: ["DETAILING"],
  },
  {
    name: "Headlight Restoration",
    description: "Sand, polish and UV-seal both headlights.",
    price: 120,
    minutes: 60,
    categories: ["DETAILING"],
  },
  {
    name: "Odor Elimination",
    description: "Ozone treatment for smoke and odors.",
    price: 90,
    minutes: 30,
    categories: ["DETAILING"],
  },
  {
    name: "Glass Ceramic Coating",
    description: "Hydrophobic coating on all exterior glass.",
    price: 99,
    minutes: 30,
    categories: ["DETAILING", "WINDOW_TINT"],
  },
  {
    name: "Tint Removal (per window set)",
    description: "Remove old film and adhesive before install.",
    price: 100,
    minutes: 60,
    categories: ["WINDOW_TINT"],
  },
];

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, bayCount: 3, slotIntervalMin: 30, minLeadHours: 12, bookingWindowDays: 60 },
  });

  // PLACEHOLDER hours: Mon–Fri 8–6, Sat 9–4, Sun closed.
  for (let d = 1; d <= 7; d++) {
    const data =
      d <= 5
        ? { isOpen: true, openMinute: 480, closeMinute: 1080 }
        : d === 6
          ? { isOpen: true, openMinute: 540, closeMinute: 960 }
          : { isOpen: false, openMinute: 540, closeMinute: 960 };
    await db.businessHours.upsert({ where: { weekday: d }, update: {}, create: { weekday: d, ...data } });
  }

  for (const [i, s] of services.entries()) {
    const deposit = s.deposit ?? { type: "FLAT" as const, value: 50 };
    const svc = await db.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        category: s.category,
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        features: s.features,
        bookingMode: s.mode ?? "INSTANT",
        durationDays: s.durationDays ?? null,
        startingAtCents: s.startingAt ? s.startingAt * 100 : null,
        depositType: deposit.type,
        depositValue: deposit.type === "FLAT" ? deposit.value * 100 : deposit.value,
        popular: s.popular ?? false,
        sortOrder: i,
      },
    });
    if (s.prices) {
      await db.servicePrice.createMany({
        data: s.prices.map(([dollars, minutes], j) => ({
          serviceId: svc.id,
          vehicleSize: SIZES[j],
          priceCents: dollars * 100,
          durationMinutes: minutes,
        })),
        skipDuplicates: true,
      });
    }
  }

  if ((await db.addOn.count()) === 0) {
    await db.addOn.createMany({
      data: addOns.map((a, i) => ({
        name: a.name,
        description: a.description,
        priceCents: a.price * 100,
        durationMinutes: a.minutes,
        categories: a.categories,
        sortOrder: i,
      })),
    });
  }

  console.log(`Seeded ${services.length} services and ${addOns.length} add-ons.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
