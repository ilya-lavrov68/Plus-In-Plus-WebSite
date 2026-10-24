import type { PostView, ServiceView } from "@/lib/data";
import {
  POST_COVER_PLACEHOLDER,
  SERVICE_COVER_PLACEHOLDER,
  postCover,
  serviceCover,
} from "@/lib/content-placeholders";

export interface CatalogServiceItem extends ServiceView {
  shapesIntroduction: string;
  gallery: string[];
}

export interface StudioBlogSection {
  title: string;
  subtitle?: string;
  paragraphs: string[];
}

export interface CatalogBlogPost {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
  /** Source timestamp for locale-aware formatting; presets may omit it. */
  publishedAt?: Date;
  metaLabel: string;
  category: "Design" | "Studio" | "Outdoor";
  readTime: number;
  image: string;
  excerpt: string;
  lead: string;
  quote: string;
  quoteAttribution: string;
  author: {
    name: string;
    role: string;
    initials: string;
  };
  sections: StudioBlogSection[];
  closing: string;
  htmlContent?: string;
  /** Only the untouched legacy launch seed may use its authored translation. */
  useLegacyLaunchCopy?: boolean;
}

export const STUDIO_SERVICES: CatalogServiceItem[] = [
  // ── Small designs (4 items) ──────────────────────────────────────────────
  {
    id: "svc-sign-design",
    slug: "sign-design",
    title: "Sign Design",
    category: "small",
    shortDesc:
      "Architectural storefront signage engineered for instant day-and-night legibility and brand presence.",
    fullDesc:
      "A sign is the face of your business. It shapes the first impression, grabs the attention of passersby, and sets the tone for your entire brand. We create more than just an image; we build an effective navigation and advertising tool that works for you 24/7.",
    includes: [
      "Location analysis: We consider the building’s architecture, lighting, and surroundings to ensure the sign blends harmoniously with the environment while still standing out.",
      "Readability and contrast: We select fonts and colors to ensure your company name is instantly legible—both day and night.",
      "Technical expertise: We prepare a layout that accounts for production requirements (materials, lighting, mounting) so the design can be executed without compromising quality.",
      "Visualization (3D mockup): Before production begins, you will see exactly how the sign will look on your building’s facade.",
    ],
    shapesIntroduction:
      "We aren't limited to standard rectangular light boxes. A sign's shape is part of its character. Depending on your brand's needs, we can design:",
    shapes: [
      "Classic light boxes (rectangular or square).",
      "Custom-shaped signs (following a logo outline or object silhouette).",
      "Dimensional letters (with halo, face, or combined lighting).",
      "Projecting signs (double-sided, mounted perpendicular to the wall).",
      "Neon installations and interior signage.",
      "Non-standard geometric shapes (circles, arches, polygons).",
    ],
    resultText:
      "A production-ready layout and realistic visualization to help you secure approval from your landlord or local authorities.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-bag-design",
    slug: "bag-design",
    title: "Bag Design",
    category: "small",
    shortDesc:
      "Tactile retail and event bags that carry your brand identity effortlessly across the city.",
    fullDesc:
      "Branded bags turn every customer walk into natural street-level visibility. We craft balanced typography, durable print specifications, and distinctive handle-to-panel proportions tailored to retail boutiques, conferences, and product launches.",
    includes: [
      "Material & finish pairing: Selection of cotton canvas, kraft paper, or laminated stock suited to print weight.",
      "Typography & scale balance: High-contrast brand marks readable both up close and across busy streets.",
      "Print-ready dielines: Exact bleed, crease, gusset, and Pantone/CMYK separation files for manufacturers.",
      "Photorealistic mockup set: Real-world lighting previews before committing to a full print run.",
    ],
    shapesIntroduction:
      "Every event and retail format calls for the right silhouette and carry style:",
    shapes: [
      "Heavyweight cotton & canvas tote bags.",
      "Boutique vertical shoppers with cord handles.",
      "Wide-gusset presentation & gift bags.",
      "Minimalist monochrome kraft carriers.",
      "Die-cut handle conference merch bags.",
      "Custom limited-edition capsule packaging.",
    ],
    resultText:
      "Complete manufacturer-ready dielines, color separations, and realistic mockups ready for immediate print production.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-outdoor-glass-poster",
    slug: "outdoor-glass-poster",
    title: "Outdoor glass poster",
    category: "small",
    shortDesc:
      "High-contrast window displays and storefront glass graphics built to stop foot traffic.",
    fullDesc:
      "Storefront glass is prime visual real estate. We design crisp window posters and vinyl glass compositions that account for daylight reflections, interior backlighting, and pedestrian sightlines.",
    includes: [
      "Glare & lighting study: Contrast calibrated for sunlit glass storefronts and evening interior glow.",
      "Clear visual hierarchy: Headline, offer, and call to action legible within a two-second walk-by glance.",
      "Print & vinyl specs: Perforated, frosted, opaque, or backlit film preparation at 1:1 scale.",
      "Storefront visualization: Realistic architectural preview directly on glass.",
    ],
    shapesIntroduction:
      "Flexible formats designed around your window mullions and entrance architecture:",
    shapes: [
      "A0 / A1 / B1 vertical showcase posters.",
      "Full-height storefront window panels.",
      "Frosted & cut-vinyl typographic decals.",
      "Double-sided indoor/outdoor glass prints.",
      "Seasonal campaign series triptychs.",
      "Custom geometric die-cut window graphics.",
    ],
    resultText:
      "Print-ready high-resolution files and facade preview mockups engineered for crisp, reflection-resistant installation.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-banner-design",
    slug: "banner-design",
    title: "Banner Design",
    category: "small",
    shortDesc:
      "Versatile event, exhibition, and promotional banners with sharp hierarchy at every viewing distance.",
    fullDesc:
      "Whether framing a conference stage, an entrance zone, or a seasonal launch, a great banner communicates its core message cleanly without visual noise. We design modular banners adaptable across digital and print dimensions.",
    includes: [
      "Distance-tested typography: Balanced hierarchy for both close-up attendees and wide venue shots.",
      "Brand-consistent grid: Unified visual system across roll-ups, press walls, and digital placements.",
      "Production prepress: Exact grommet margins, safe zones, and CMYK color profiles.",
      "3D venue preview: Mockups showing real scale in context before printing.",
    ],
    shapesIntroduction:
      "Adapted cleanly to any venue stand, frame, or mounting system:",
    shapes: [
      "Retractable roll-up & X-stand banners.",
      "Stage backdrops & press walls.",
      " Entrance arch & hanging venue banners.",
      "Street pole vertical flags.",
      "Modular trade-show booth panels.",
      "Cross-channel digital & print campaign kits.",
    ],
    resultText:
      "Press-ready banner layouts with safe-zone guides and realistic venue visualizations.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },

  // ── Large designs (4 items) ──────────────────────────────────────────────
  {
    id: "svc-large-billboard",
    slug: "large-billboard",
    title: "Large Billboard on a building",
    category: "large",
    shortDesc:
      "Monumental facade media and multi-story building wraps engineered for city-wide impact.",
    fullDesc:
      "Monumental building facades demand bold restraint: a single unforgettable visual anchor and razor-sharp copy readable from hundreds of meters away. We design large-scale architectural wraps tailored to urban sightlines.",
    includes: [
      "Urban sightline analysis: Viewing angles evaluated across key intersections and avenues.",
      "Ultra-scale prepress: Vector and high-DPI master files engineered for multi-story mesh or vinyl.",
      "Architectural integration: Proportions aligned cleanly with facade rhythm and lighting.",
      "Day & dusk 3D visualization: Cityscape mockups for stakeholder and municipal review.",
    ],
    shapesIntroduction:
      "Engineered for diverse architectural surfaces and structural frames:",
    shapes: [
      "Vertical multi-story end-wall wraps.",
      "Wide panoramic facade banners.",
      "Perforated building mesh installations.",
      "Corner-wrap two-elevation compositions.",
      " scaffold & renovation facade covers.",
      "Illuminated night-visibility mega-boards.",
    ],
    resultText:
      "Full-scale production master files with structural margin specs and realistic cityscape visualizations.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-rooftop-advertising",
    slug: "rooftop-advertising",
    title: "Rooftop advertising",
    category: "large",
    shortDesc:
      "Skyline letterforms and illuminated rooftop installations that crown urban architecture.",
    fullDesc:
      "Rooftop installations turn your brand into a permanent city landmark visible day and night. We design bold structural letterforms and light-crown compositions built for long-distance legibility against both bright sky and night horizons.",
    includes: [
      "Skyline contrast study: Day silhouette and night LED halo simulation.",
      "Structural letterform geometry: Wind-load-friendly proportions and stroke weights.",
      "Lighting specification: Face-lit, halo-lit, or programmable pixel- contour schemes.",
      "Photorealistic skyline preview: Day and night 3D architectural renders.",
    ],
    shapesIntroduction:
      "Designed for maximum clarity at skyline elevation:",
    shapes: [
      " giant dimensional channel letters.",
      " freestanding brand emblems & logomarks.",
      " Panoramic rooftop lightboxes.",
      " Open-frame neon & LED contour structures.",
      " Corner-angled dual-avenue crowns.",
      " Composite letter-and-symbol skyline units.",
    ],
    resultText:
      "Complete architectural design package with day/night renders ready for engineering fabrication and city approval.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-advertisement-on-the-fence",
    slug: "advertisement-on-the-fence",
    title: "Advertisement on the fence",
    category: "large",
    shortDesc:
      "Continuous street-level perimeter branding for developments, venues, and urban sites.",
    fullDesc:
      "Perimeter fencing offers hundreds of linear meters right at eye level for both pedestrians and drivers. We design rhythmic, modular fence campaigns that tell a cohesive story across every panel.",
    includes: [
      "Rhythmic panel pacing: Seamless repetition and sequence for walking and driving speeds.",
      "Modular panel sizing: Flexible sections adaptable to gates, corners, and uneven terrain.",
      "Weatherproof prepress: High-contrast palettes resistant to street dust and harsh sunlight.",
      "On-site perspective mockup: Full street-level visualization across the entire perimeter.",
    ],
    shapesIntroduction:
      "Tailored to every site boundary and structural fence format:",
    shapes: [
      "Solid corrugated & composite hoarding panels.",
      "Breathable wind-mesh perimeter banners.",
      "Sequential storytelling development hoardings.",
      "Wayfinding & entrance gate modules.",
      "Festival & stadium crowd-barrier wraps.",
      " architectural render gallery hoardings.",
    ],
    resultText:
      "Panel-by-panel production files with numbering map and full street-view visualization.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
  {
    id: "svc-billboard",
    slug: "billboard",
    title: "Billboard",
    category: "large",
    shortDesc:
      "Three-second highway and arterial road billboards crafted for instant recall.",
    fullDesc:
      "At 60 km/h, a driver gives a billboard three seconds or less. We strip away clutter to craft high-impact highway and avenue boards built around one unmistakable focal visual, crisp contrast, and memorable copy.",
    includes: [
      "3-second legibility test: Distance and speed check before finalizing layout.",
      "Bold focal art direction: Single clear visual idea without competing clutter.",
      "Multi-format adaptation: Standard 3×6 m, superboards, and digital DOOH screens.",
      "Real roadside mockup: Daytime and illuminated night previews in traffic context.",
    ],
    shapesIntroduction:
      "Prepared for every roadside static and digital inventory format:",
    shapes: [
      "Standard 6×3 m roadside euro-billboards.",
      "12×4 m & 15×5 m highway superboards.",
      "Digital LED roadside DOOH motion-ready stills.",
      "Three-sided prismatron layouts.",
      "Die-cut extender boards breaking the frame.",
      "City-format 1.2×1.8 m shelter companions.",
    ],
    resultText:
      "Press- and DOOH-ready master files calibrated to outdoor operator technical requirements.",
    coverImage: SERVICE_COVER_PLACEHOLDER,
    gallery: [
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
      SERVICE_COVER_PLACEHOLDER,
    ],
  },
];

export const STUDIO_BLOG_POSTS: CatalogBlogPost[] = [
  {
    id: "post-were-up-and-running",
    slug: "we-re-up-and-running",
    title: "We're Up and Running",
    dateLabel: "October 7, 2026",
    metaLabel: "October 7, 2026 · 4-minute read",
    category: "Studio",
    readTime: 4,
    image: POST_COVER_PLACEHOLDER,
    excerpt:
      "Now our new website is live—and it’s more than just an updated showcase. It’s a clearer story of how we help products become cohesive and ready for growth.",
    lead: "We’ve long wanted to bring together in one place everything that Plus In Plus has become: our approach, our services, and the projects through which we put ideas to the test. Now our new website is live—and it’s more than just an updated showcase. It’s a clearer story of how we help products become cohesive and ready for growth.",
    quote:
      "We care not only about how a single screen looks, but also about how all parts of the product work together.",
    quoteAttribution: "Plus In Plus Studio",
    author: {
      name: "Plus In Plus Editorial",
      role: "Design Studio Team",
      initials: "PP",
    },
    sections: [
      {
        title: "It's Not Just About Design",
        paragraphs: [
          "Plus In Plus began with a desire to make ideas clear and expressive. Over time, it became clear that a visual solution alone wasn’t enough. For a product to work, you need to tie together its goals, user experience, interface, and technological foundation.",
          "That’s why today we take a broader view of the task—from the initial questions about the product to design, design systems, and front-end development. We care not only about how a single screen looks, but also about how all parts of the product work together.",
        ],
      },
      {
        title: "Why We Needed a New Website",
        subtitle:
          "The website was meant to answer a simple question: how can Plus In Plus be useful to your team?",
        paragraphs: [
          "We restructured the site to immediately highlight our main areas of focus: web design and UX, design systems, and front-end development. We also highlighted our systematic approach—where a solution helps not only launch a product but also develop it further.",
          "The visual language also became part of this narrative: clean typography, white space, and precise details create a sense of clarity rather than clutter. And snippets of interfaces and projects allow visitors to see our approach in context.",
        ],
      },
      {
        title: "Experience That Grows Alongside Our Products",
        paragraphs: [
          "An important part of our work consists of our own projects and ecosystems: Ozone and Plus For Play. They help us view a product not just through a single mockup, but through real-world scenarios, user feedback, and iterative development.",
          "This experience shapes how we approach new challenges: first, we understand the context; then, we build a clear system of solutions; and only then do we move on to implementation.",
        ],
      },
      {
        title: "What's Next",
        paragraphs: [
          "Launching a website isn’t the end—it’s the beginning of the next phase. We’ll be adding case studies, articles on design and development, and new insights from our product practice.",
          "If you have an idea that needs to be turned into a clear and scalable product—tell us about it. Let’s discuss the best place to start.",
        ],
      },
    ],
    closing: "The new Plus In Plus website is now live. Welcome.",
  },
  {
    id: "post-architectural-signage-principles",
    slug: "architectural-signage-principles",
    title: "Designing Storefront Signage That Works Day and Night",
    dateLabel: "October 2, 2026",
    metaLabel: "October 2, 2026 · 5-minute read",
    category: "Outdoor",
    readTime: 5,
    image: POST_COVER_PLACEHOLDER,
    excerpt:
      "How viewing geometry, facade materials, and halo lighting turn ordinary shopfronts into unmistakable street landmarks.",
    lead: "Great signage never fights the building it lives on. Instead, it studies brick texture, street width, sun angles, and evening illumination so the brand feels native to the architecture while remaining instantly legible from across the avenue.",
    quote:
      "A sign shapes the first impression in under two seconds—long before a visitor steps through the door.",
    quoteAttribution: "Plus In Plus Outdoor Practice",
    author: {
      name: "Plus In Plus Editorial",
      role: "Brand & Spatial Design",
      initials: "PP",
    },
    sections: [
      {
        title: "Start With Sightlines, Not Just Fonts",
        paragraphs: [
          "Pedestrians approach parallel to a facade, while drivers read from oblique angles across traffic lanes. Combining a primary fascia sign with a perpendicular projecting blade gives both audiences effortless legibility.",
          "Before picking letter thickness, our studio maps real approach distances and ambient street lighting so contrast holds up equally at noon and midnight.",
        ],
      },
      {
        title: "Materials That Age With Character",
        paragraphs: [
          "Matte powder-coated aluminum, brushed steel, and diffused acrylic age cleanly without glare. Paired with 3D facade visualizations, every detail is verified before fabrication begins.",
        ],
      },
    ],
    closing:
      "Planning a storefront or rebranding a physical space? Explore our Sign Design service to get started.",
  },
  {
    id: "post-city-scale-visual-hierarchy",
    slug: "city-scale-visual-hierarchy",
    title: "City-Scale Hierarchy: What Makes Large Format Memorable",
    dateLabel: "September 24, 2026",
    metaLabel: "September 24, 2026 · 3-minute read",
    category: "Design",
    readTime: 3,
    image: POST_COVER_PLACEHOLDER,
    excerpt:
      "Why restraint, contrast, and five words or fewer beat dense layouts on high-speed urban avenues.",
    lead: "When scaling a campaign from a smartphone screen to a ten-story building wrap, every extra element competes for attention. Clarity wins when typography, negative space, and a single visual anchor work in unison.",
    quote:
      "At city scale, whitespace isn’t empty—it is the frame that makes your message unmissable.",
    quoteAttribution: "Plus In Plus Creative Direction",
    author: {
      name: "Plus In Plus Editorial",
      role: "Visual Systems",
      initials: "PP",
    },
    sections: [
      {
        title: "One Idea Per Surface",
        paragraphs: [
          "Outdoor campaigns succeed when viewers absorb the brand and core promise in a single glance. Stripping secondary clutter raises recall dramatically across both highway billboards and rooftop crowns.",
        ],
      },
      {
        title: "Unified Across Small and Large Touchpoints",
        paragraphs: [
          "From a branded cotton tote bag to a multi-story facade wrap, maintaining one coherent typographic voice turns isolated placements into a recognizable brand system.",
        ],
      },
    ],
    closing:
      "Ready to launch your next campaign? Visit our Shop or reach out to our team.",
  },
  {
    id: "post-tactile-brand-collateral",
    slug: "tactile-brand-collateral",
    title: "Packaging Ideas Into Tactile Event Collateral",
    dateLabel: "September 14, 2026",
    metaLabel: "September 14, 2026 · 4-minute read",
    category: "Design",
    readTime: 4,
    image: POST_COVER_PLACEHOLDER,
    excerpt:
      "From conference totes to window posters: crafting physical touchpoints people actually keep.",
    lead: "Event collateral often gets treated as a last-minute checklist item. Treated thoughtfully, a well-proportioned bag, badge, and stage banner become the most photographed part of the entire gathering.",
    quote:
      "People keep objects that feel considered—and every kept object extends the life of your event.",
    quoteAttribution: "Plus In Plus Studio",
    author: {
      name: "Plus In Plus Editorial",
      role: "Brand Identity",
      initials: "PP",
    },
    sections: [
      {
        title: "Designing for Real Hands and Real Cameras",
        paragraphs: [
          "Heavyweight cotton stock, bold typographic placement, and clean color blocking photograph sharply under venue lighting and hold up long after the event wraps.",
        ],
      },
    ],
    closing:
      "Tell us about your upcoming launch or event—we’ll package it with clarity and style.",
  },
];

export function mergeCatalogServices(
  dbServices: ServiceView[]
): CatalogServiceItem[] {
  // The database is authoritative: an empty result must never republish presets.
  return dbServices.map((svc) => {
    const preset = STUDIO_SERVICES.find(
      (item) =>
        item.slug === svc.slug ||
        (svc.slug === "large-billboard-building" &&
          item.slug === "large-billboard") ||
        (svc.slug === "advertisement-fence" &&
          item.slug === "advertisement-on-the-fence")
    );
    const validCover = serviceCover(svc.coverImage);

    return {
      ...svc,
      category: svc.category === "large" ? "large" : "small",
      coverImage: validCover,
      shapesIntroduction:
        preset?.shapesIntroduction ??
        "Depending on your brand's needs, we can design:",
      gallery: [validCover],
    };
  });
}

export function resolveServiceBySlug(
  slug: string,
  dbService: ServiceView | null
): CatalogServiceItem | null {
  const normalized = slug.toLowerCase();
  const preset = STUDIO_SERVICES.find(
    (s) =>
      s.slug === normalized ||
      s.id === slug ||
      (normalized === "large-billboard-building" && s.slug === "large-billboard") ||
      (normalized === "advertisement-fence" && s.slug === "advertisement-on-the-fence")
  );

  if (dbService) {
    const cover = serviceCover(dbService.coverImage);
    return {
      ...dbService,
      category: dbService.category === "large" ? "large" : "small",
      coverImage: cover,
      shapesIntroduction:
        preset?.shapesIntroduction ??
        "We aren't limited to standard shapes. Depending on your brand's needs, we can design:",
      gallery: [cover],
    };
  }

  // A missing/unpublished database row is a 404/redirect, not a preset fallback.
  return null;
}

export function mergeCatalogPosts(dbPosts: PostView[]): CatalogBlogPost[] {
  return dbPosts.map((post) => {
    const preset = STUDIO_BLOG_POSTS.find(
      (candidate) =>
        candidate.slug === post.slug ||
        (post.slug === "were-up-and-running" &&
          candidate.slug === "we-re-up-and-running")
    );

    const validCover = postCover(post.coverImage);
    const dateObj = post.publishedAt ?? post.createdAt;
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(dateObj));
    const readMins = post.readTime || preset?.readTime || 4;

    // The original demo seed stored only one HTML paragraph for the launch
    // article. Preserve its authored four-section translation only for that
    // exact, untouched legacy row. Any CMS edit switches the body back to the
    // database immediately; presets never override an editor's content.
    const useLegacyLaunchCopy = Boolean(
      preset?.slug === "we-re-up-and-running" &&
        post.title === preset.title &&
        post.excerpt === preset.excerpt &&
        post.content.trim() === `<p>${preset.excerpt}</p>`
    );

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      dateLabel: formattedDate,
      publishedAt: dateObj,
      metaLabel: `${formattedDate} · ${readMins}-minute read`,
      category: preset?.category ?? "Studio",
      readTime: readMins,
      image: validCover,
      excerpt: post.excerpt,
      lead: useLegacyLaunchCopy ? preset!.lead : post.excerpt,
      quote: useLegacyLaunchCopy ? preset!.quote : post.excerpt,
      quoteAttribution: useLegacyLaunchCopy
        ? preset!.quoteAttribution
        : "Plus In Plus Studio",
      author: preset?.author ?? {
        name: "Plus In Plus Editorial",
        role: "Design Studio Team",
        initials: "PP",
      },
      sections: useLegacyLaunchCopy ? preset!.sections : [],
      closing: useLegacyLaunchCopy ? preset!.closing : "",
      htmlContent: useLegacyLaunchCopy ? undefined : post.content,
      useLegacyLaunchCopy,
    };
  });
}
