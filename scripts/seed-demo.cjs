// Fills the local development database with Plus In Plus studio services,
// articles, demo accounts, orders, and analytics events.
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
const config = resolveDatabaseConfig({
  env: { ...process.env, NODE_ENV: "development" },
  rootDir,
  allowDevelopmentFallback: true,
});

if (!config) {
  console.error("[seed-demo] No database target. Set TURSO_DATABASE_URL (see .env.example).");
  process.exit(1);
}
if (config.remote) {
  console.error(
    `[seed-demo] Refusing to seed a remote database (${describeDatabaseUrl(config.url)}).\n` +
      "This script deletes rows first and is only meant for the local dev file.",
  );
  process.exit(1);
}

const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

const client = createClient({ url: config.url, authToken: config.authToken });
const now = Date.now();
const at = (ms) => (ms === null ? null : new Date(ms).toISOString());

// [title, slug, category, shortDesc, fullDesc, includes(json), shapes(json),
//  resultText, coverImage, isPublished, sortOrder, basePrice(kopecks), priceType, isOrderable]
const services = [
  [
    "Sign Design",
    "sign-design",
    "small",
    "Custom storefront signs, dimensional channel letters, and realistic 3D facade previews.",
    "A sign is the face of your business and the first thing a customer sees. It sets the tone and conveys the character of your brand long before a customer walks through the door. We design signage that grabs attention, blends harmoniously with the urban environment, and works for your image 24/7.",
    JSON.stringify([
      "Concept development: Analyzing your brand, target audience, and architectural features of the facade.",
      "Design of any complexity: From minimalist flat panels to complex shapes.",
      "3D visualization (Mockup): Showing how your future sign will look directly on your building in both daylight and nighttime.",
      "Production-ready files: Providing layouts strictly in accordance with technical requirements, ready to be sent to the manufacturing workshop.",
    ]),
    JSON.stringify([
      "Volumetric letters (illuminated, non-illuminated, or halo-lit).",
      "Lightboxes of classic and custom shapes.",
      "Neon signs for striking interiors and storefronts.",
      "Blade signs (panel-brackets) to attract pedestrian traffic.",
      " Rooftop installations and large-scale facade structures.",
      "Office plaques and navigation signs.",
    ]),
    "You get a stylish, noticeable, and thought-out design that sets you apart from competitors and turns passersby into loyal customers.",
    "/assets/shop/sign-design.jpg",
    1,
    1,
    1_500_000,
    "from",
    1,
  ],
  [
    "Bag Design",
    "bag-design",
    "small",
    "Tactile retail, event, and gift bag layouts that carry your brand identity across the city.",
    "Branded bags turn every purchase or event handout into a clean, walking brand statement with balanced typography, dielines, and print finishes.",
    JSON.stringify([
      "Brand & material pairing: Selecting paper stocks, handles, and tactile finishes.",
      "Structural dieline layout: Exact gusset, fold, and bleed preparation.",
      "3D photorealistic mockup: Studio lighting visualization before printing.",
      "Print-ready package: CMYK/Pantone files with foil and spot-UV masks.",
    ]),
    JSON.stringify([
      "Matte laminated boutique bags.",
      "Natural kraft retail carriers.",
      "Conference welcome bags.",
      "Square luxury gift bags.",
    ]),
    "A distinctive, durable bag design ready for immediate production.",
    "/assets/shop/bag-design.jpg",
    1,
    2,
    650_000,
    "from",
    1,
  ],
  [
    "Outdoor glass poster",
    "outdoor-glass-poster",
    "small",
    "High-contrast window displays and architectural glass graphics readable day and night.",
    "Storefront windows are your most valuable street-level media surface, calibrated carefully against glare, reflections, and viewing angles.",
    JSON.stringify([
      "Facade sightline planning.",
      "Glare-safe contrast hierarchy.",
      "Day & evening storefront preview.",
      "Cut-contour & print files.",
    ]),
    JSON.stringify([
      "Full-height window campaigns.",
      "Backlit light-pocket posters.",
      "Die-cut vinyl typography.",
      "Frosted glass privacy bands.",
    ]),
    "Crisp, inviting window graphics ready for print and clean installation.",
    "/assets/shop/outdoor-glass-poster.jpg",
    1,
    3,
    490_000,
    "from",
    1,
  ],
  [
    "Banner Design",
    "banner-design",
    "small",
    "Clean event backdrops, roll-ups, and street banners engineered for instant clarity.",
    "Whether framing a stage, trade booth, or street entrance, a banner has seconds to communicate your message cleanly.",
    JSON.stringify([
      "Viewing-distance layout.",
      "Modular multi-size adaptation.",
      "On-site realistic mockup.",
      "Prepress & grommet-safe margins.",
    ]),
    JSON.stringify([
      "Retractable roll-up stands.",
      "Press-wall & stage backdrops.",
      "Facade tension banners.",
      "Wayfinding totems.",
    ]),
    "Sharp, balanced banners ready for any venue or storefront.",
    "/assets/shop/banner-design.jpg",
    1,
    4,
    390_000,
    "fixed",
    1,
  ],
  [
    "Large Billboard on a building",
    "large-billboard",
    "large",
    "Monumental facade wraps and multi-story building media built for citywide visibility.",
    "Monumental building wraps command attention across entire districts and avenues, engineered around facade geometry and long-range legibility.",
    JSON.stringify([
      "Architectural facade mapping.",
      "Long-range typographic scale.",
      "Day & floodlit night visualization.",
      "Segmented prepress tile delivery.",
    ]),
    JSON.stringify([
      "Multi-story mesh facade wraps.",
      "Gable-end landmark murals.",
      "Illuminated tension frames.",
      "Corner wraparound media.",
    ]),
    "Monumental building-scale artwork engineered for clean installation.",
    "/assets/shop/large-billboard-building.jpg",
    1,
    5,
    3_500_000,
    "from",
    1,
  ],
  [
    "Rooftop advertising",
    "rooftop-advertising",
    "large",
    "Skyline-defining illuminated rooftop letters and brand crowns visible from kilometers away.",
    "Rooftop structures crown city skylines with luminous dimensional typography designed for day and night recognition.",
    JSON.stringify([
      "Skyline & horizon study.",
      "Day/night LED illumination design.",
      "Photorealistic aerial & street renders.",
      "Fabrication-ready vector specs.",
    ]),
    JSON.stringify([
      "Dimensional channel letters.",
      "Freestanding brand emblems.",
      "Panoramic rooftop lightboxes.",
      "Open-frame LED structures.",
    ]),
    "Architectural rooftop design package ready for fabrication.",
    "/assets/shop/rooftop-advertising.jpg",
    1,
    6,
    4_200_000,
    "quote",
    1,
  ],
  [
    "Advertisement on the fence",
    "advertisement-on-the-fence",
    "large",
    "Continuous street-level perimeter branding for developments, venues, and urban sites.",
    "Modular fence campaigns turn hundreds of meters of site perimeter into a rhythmic, high-contrast brand narrative.",
    JSON.stringify([
      "Rhythmic panel pacing.",
      "Modular gate & corner sizing.",
      "Weatherproof high-contrast palette.",
      "Full street-perspective mockup.",
    ]),
    JSON.stringify([
      "Solid composite hoarding panels.",
      "Wind-mesh perimeter banners.",
      "Sequential development hoardings.",
      "Festival crowd-barrier wraps.",
    ]),
    "Numbered panel-by-panel production layouts with full street visualization.",
    "/assets/shop/advertisement-on-the-fence.jpg",
    1,
    7,
    1_900_000,
    "from",
    1,
  ],
  [
    "Billboard",
    "billboard",
    "large",
    "Three-second highway and arterial road billboards crafted for instant recall.",
    "High-impact 6×3 m, superboard, and digital DOOH outdoor layouts built around one unmistakable focal idea.",
    JSON.stringify([
      "3-second distance legibility check.",
      "Single clear focal composition.",
      "Static & digital DOOH adaptation.",
      "Day & night traffic context mockup.",
    ]),
    JSON.stringify([
      "Standard 6×3 m roadside boards.",
      "12×4 m highway superboards.",
      "Digital LED DOOH screens.",
      "Die-cut extender formats.",
    ]),
    "Press- and DOOH-ready master files calibrated to operator specs.",
    "/assets/shop/billboard.jpg",
    1,
    8,
    950_000,
    "fixed",
    1,
  ],
];

const optionGroups = {
  "sign-design": [
    [
      "Material",
      1,
      [
        ["PVC 5 mm", 0, 1],
        ["Acrylic 5 mm", 400_000, 1],
        ["Brushed Composite", 650_000, 1],
      ],
    ],
    [
      "Illumination",
      0,
      [
        ["Non-illuminated", 0, 1],
        ["Face-lit LED", 800_000, 1],
        ["Halo-lit Contour LED", 950_000, 1],
      ],
    ],
  ],
  billboard: [
    [
      "Format",
      1,
      [
        ["6 × 3 m Standard", 0, 1],
        ["12 × 4 m Superboard", 0, 1.8],
        ["Digital DOOH Package", 250_000, 1],
      ],
    ],
  ],
};

const posts = [
  [
    "We're Up and Running",
    "we-re-up-and-running",
    "Now our new website is live—and it’s more than just an updated showcase. It’s a clearer story of how we help products become cohesive and ready for growth.",
    "<p>Now our new website is live—and it’s more than just an updated showcase. It’s a clearer story of how we help products become cohesive and ready for growth.</p>",
    "/assets/shop/sign-design.jpg",
    4,
    "manual",
    null,
    1,
    1,
    "2026-10-07",
  ],
  [
    "How Exterior Signage Shapes First Impressions",
    "how-exterior-signage-shapes-first-impressions",
    "From viewing angles at dusk to halo-lit typography—practical principles behind signs people remember.",
    "<p>Great storefront signage balances facade architecture, clean letterforms, and illumination across both bright midday light and night streets.</p><p>By previewing every sign in 3D before fabrication, teams avoid costly guesswork and launch with confidence.</p>",
    "/assets/shop/sign-design-2.jpg",
    5,
    "manual",
    null,
    0,
    1,
    "2026-10-03",
  ],
  [
    "Designing Large-Format Billboards That Read in Three Seconds",
    "designing-large-format-billboards-that-read-in-three-seconds",
    "Why restraint, contrast, and scale matter more than ever across city highways and building wraps.",
    "<p>Outdoor campaigns succeed when hierarchy is unmistakable within three seconds: one focal visual, bold contrast, and zero competing clutter.</p>",
    "/assets/shop/large-billboard-building.jpg",
    4,
    "manual",
    null,
    0,
    1,
    "2026-09-24",
  ],
  [
    "Print & Packaging Systems for Events and Retail",
    "print-and-packaging-systems-for-events-and-retail",
    "How cohesive bags, banners, and glass posters turn physical spaces into a unified brand experience.",
    "<p>Cohesive physical collateral unifies every touchpoint from street window displays to event stages and retail packaging.</p>",
    "/assets/shop/bag-design.jpg",
    3,
    "manual",
    null,
    0,
    1,
    "2026-09-15",
  ],
];

const users = [
  ["founder@plusinplus.test", "FounderPassphrase123", "Demo", "Founder", "FOUNDER", 0],
  ["admin@plusinplus.test", "AdminPassphrase123", "Demo", "Admin", "ADMIN", 0],
  ["manager@plusinplus.test", "ManagerPassphrase123", "Anna", "Morozova", "MANAGER", 0],
  ["user1@plusinplus.test", "ClientPassphrase123", "Ivan", "Petrov", "USER", 0],
  ["user2@plusinplus.test", "ClientPassphrase123", "Maria", "Sidorova", "USER", 1],
];

const count = async (table) =>
  Number((await client.execute(`SELECT count(*) c FROM ${table}`)).rows[0].c);

(async () => {
  console.log(`[seed-demo] Database: ${describeDatabaseUrl(config.url)}`);

  await client.execute("DELETE FROM order_services");
  await client.execute("DELETE FROM order_items");
  await client.execute("DELETE FROM payments");
  await client.execute("DELETE FROM orders");
  await client.execute("DELETE FROM cart_items");
  await client.execute("DELETE FROM service_options");
  await client.execute("DELETE FROM service_option_groups");
  await client.execute("DELETE FROM services");
  await client.execute("DELETE FROM posts");
  await client.execute("DELETE FROM users");
  await client.execute("DELETE FROM page_views");

  for (const s of services) {
    const [
      title,
      slug,
      category,
      shortDesc,
      fullDesc,
      includes,
      shapes,
      resultText,
      coverImage,
      isPublished,
      sortOrder,
      basePrice,
      priceType,
      isOrderable,
    ] = s;
    await client.execute({
      sql: "INSERT INTO services (id,title,slug,category,shortDesc,fullDesc,includes,shapes,resultText,coverImage,isPublished,isActive,sortOrder,basePrice,priceType,currency,isOrderable,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        `svc-${slug}`,
        title,
        slug,
        category,
        shortDesc,
        fullDesc,
        includes,
        shapes,
        resultText,
        coverImage,
        isPublished,
        1,
        sortOrder,
        basePrice,
        priceType,
        "RUB",
        isOrderable,
        at(now),
        at(now),
      ],
    });
  }

  let groupCount = 0;
  let optionCount = 0;
  for (const [slug, groups] of Object.entries(optionGroups)) {
    for (const [name, required, options] of groups) {
      const groupId = `grp-${slug}-${groupCount++}`;
      await client.execute({
        sql: "INSERT INTO service_option_groups (id,serviceId,name,required,sortOrder) VALUES (?,?,?,?,?)",
        args: [groupId, `svc-${slug}`, name, required, groupCount],
      });
      for (let idx = 0; idx < options.length; idx += 1) {
        const [label, priceDelta, priceFactor] = options[idx];
        await client.execute({
          sql: "INSERT INTO service_options (id,groupId,label,priceDelta,priceFactor,isDefault,sortOrder) VALUES (?,?,?,?,?,?,?)",
          args: [
            `opt-${optionCount++}`,
            groupId,
            label,
            priceDelta,
            priceFactor,
            idx === 0 ? 1 : 0,
            optionCount,
          ],
        });
      }
    }
  }

  for (const p of posts) {
    await client.execute({
      sql: "INSERT INTO posts (id,title,slug,excerpt,content,coverImage,readTime,source,sourceUrl,isFeatured,isPublished,publishedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        `post-${p[1]}`,
        p[0],
        p[1],
        p[2],
        p[3],
        p[4],
        p[5],
        p[6],
        p[7],
        p[8],
        p[9],
        p[10] ? at(Date.parse(p[10])) : null,
        at(now),
        at(now),
      ],
    });
  }

  for (const [email, password, firstName, lastName, role, isBlocked] of users) {
    const passwordHash = await bcrypt.hash(password, 12);
    await client.execute({
      sql: "INSERT INTO users (id,email,passwordHash,firstName,lastName,role,isBlocked,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        `usr-${email.split("@")[0]}`,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        isBlocked,
        at(now),
        at(now),
      ],
    });
  }

  const orderRows = [
    ["ПИП-000001", "user1@plusinplus.test", "completed", 2_300_000, 2_300_000, "Sign Design with halo LED", 21, true, "admin@plusinplus.test", null, "sign-design", 1],
    ["ПИП-000002", "user1@plusinplus.test", "awaiting_payment", 950_000, 950_000, "6x3m Highway Billboard", 5, false, "admin@plusinplus.test", "Approved for production", "billboard", 1],
    ["ПИП-000003", "user1@plusinplus.test", "quote_requested", 1_900_000, 0, "Storefront acrylic sign", 0, false, null, null, "sign-design", 1],
  ];

  for (const [number, email, status, estimated, agreed, note, daysAgo, paid, managerEmail, managerNote, slug, quantity] of orderRows) {
    const createdMs = now - daysAgo * 86_400_000;
    const deadlineMs = now + (14 - daysAgo) * 86_400_000;
    const paidMs = paid ? at(createdMs + 3_600_000) : null;
    const orderId = `ord-${number.slice(-6)}`;
    const userId = `usr-${email.split("@")[0]}`;
    const managerId = managerEmail ? `usr-${managerEmail.split("@")[0]}` : null;
    const priced = ["awaiting_payment", "paid", "in_progress", "completed"].includes(status);
    const priceAgreedAt = priced ? at(createdMs + 1_800_000) : null;
    const finalPrice = agreed > 0 ? agreed / 100 : null;

    await client.execute({
      sql: "INSERT INTO orders (id,number,userId,status,estimatedAmount,subtotal,discount,total,finalPrice,currency,deadline,description,customerNote,managerNote,managerId,priceAgreedAt,createdAt,updatedAt,paidAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [orderId, number, userId, status, estimated, agreed, 0, agreed, finalPrice, "RUB", at(deadlineMs), note, note, managerNote, managerId, priceAgreedAt, at(createdMs), at(createdMs), paidMs],
    });

    const unitAgreed = agreed > 0 ? Math.round(agreed / quantity) : 0;
    await client.execute({
      sql: "INSERT INTO order_items (id,orderId,serviceId,title,quantity,estimatedUnitPrice,unitPrice,totalPrice,optionsSnapshot) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        `oi-${number.slice(-6)}`,
        orderId,
        `svc-${slug}`,
        services.find((s) => s[1] === slug)[0],
        quantity,
        Math.round(estimated / quantity),
        unitAgreed,
        agreed,
        '[{"group":"Material","option":"Acrylic 5 mm"}]',
      ],
    });

    await client.execute({
      sql: "INSERT INTO order_services (id,orderId,serviceId,quantity) VALUES (?,?,?,?)",
      args: [`os-${number.slice(-6)}`, orderId, `svc-${slug}`, quantity],
    });

    if (priced) {
      await client.execute({
        sql: "INSERT INTO payments (id,orderId,provider,externalId,status,amount,currency,paymentUrl,createdAt,updatedAt,paidAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          `pay-${number.slice(-6)}`,
          orderId,
          "robokassa",
          number.slice(-6),
          paid ? "succeeded" : "pending",
          agreed,
          "RUB",
          `https://auth.robokassa.ru/Merchant/Index.aspx?InvId=${number.slice(-6)}`,
          priceAgreedAt ?? at(createdMs),
          priceAgreedAt ?? at(createdMs),
          paidMs,
        ],
      });
    }
  }

  console.log(
    `[seed-demo] Seeded ${await count("services")} services, ${await count("posts")} posts, ${await count("users")} users, ${await count("orders")} orders.`,
  );
  client.close();
})();
