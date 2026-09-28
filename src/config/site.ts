// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS INFO — every value marked PLACEHOLDER must be replaced before launch.
// Services, prices, hours and bay count live in the database and are edited in
// the admin panel (/admin), not here.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  name: "Auto Lab",
  tagline: "Precision paint protection, tint & detailing",
  description:
    "Auto Lab protects and perfects your vehicle with paint protection film, ceramic coatings, window tint and professional detailing. Book online in minutes.",

  // PLACEHOLDER — contact details
  phone: "(555) 010-2030",
  phoneHref: "tel:+15550102030",
  email: "hello@autolab.example",
  address: {
    street: "123 Placeholder Ave, Unit 4",
    city: "Your City",
    region: "CA",
    postalCode: "90000",
  },
  mapsUrl: "https://maps.google.com/?q=Auto+Lab",

  // PLACEHOLDER — social / reviews
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/",
  googleReviewsUrl: "https://google.com/",

  // PLACEHOLDER — trust signals. Only list certifications you actually hold.
  certifications: ["Certified PPF installer (brand TBD)", "Certified ceramic coating installer (brand TBD)"],

  policies: {
    // PLACEHOLDER — confirm with the owner.
    cancellationNoticeHours: 48,
    depositRefundable: true,
  },
} as const;

export const categoryMeta = {
  DETAILING: {
    slug: "detailing",
    label: "Detailing",
    short: "Deep clean, paint correction and interior restoration.",
  },
  WINDOW_TINT: {
    slug: "window-tint",
    label: "Window Tint",
    short: "Ceramic films that block heat and UV without the glare.",
  },
  PPF: {
    slug: "ppf",
    label: "Paint Protection Film",
    short: "Self-healing film that stops rock chips before they happen.",
  },
  CERAMIC_COATING: {
    slug: "ceramic-coating",
    label: "Ceramic Coating",
    short: "Years of gloss, hydrophobics and easier washes.",
  },
} as const;

export type CategoryKey = keyof typeof categoryMeta;

export const categoryBySlug = Object.fromEntries(
  Object.entries(categoryMeta).map(([k, v]) => [v.slug, k as CategoryKey]),
) as Record<string, CategoryKey>;

export const vehicleSizeMeta = {
  COUPE_SEDAN: { label: "Coupe / Sedan", example: "Civic, Model 3, 3 Series" },
  SMALL_SUV: { label: "Small SUV / Crossover", example: "RAV4, Model Y, Macan" },
  LARGE_SUV_TRUCK: { label: "Large SUV / Truck", example: "Tahoe, F-150, X7" },
  EXOTIC: { label: "Exotic / Specialty", example: "911 GT3, Huracán, G-Wagon" },
} as const;

export type VehicleSizeKey = keyof typeof vehicleSizeMeta;
export const VEHICLE_SIZES = Object.keys(vehicleSizeMeta) as VehicleSizeKey[];
