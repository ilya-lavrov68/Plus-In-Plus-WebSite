const assert = require("node:assert/strict");
const { after, before, test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createNativeModuleMock } = require("./helpers/native-payload-mock.cjs");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );

let admin;
let sessionUser;
let users;
let services;
let orders;
let orderItems;
let orderServices;
let logs;
let invalidated;
let seq;

function matchesActiveOrderForService(order, where) {
  if (where.status?.in && !where.status.in.includes(order.status)) {
    return false;
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some((clause) => {
      if (clause.services?.some?.serviceId) {
        const sid = clause.services.some.serviceId;
        return [...orderServices.values()].some(
          (os) => os.orderId === order.id && os.serviceId === sid
        );
      }
      if (clause.items?.some?.serviceId) {
        const sid = clause.items.some.serviceId;
        return [...orderItems.values()].some(
          (oi) => oi.orderId === order.id && oi.serviceId === sid
        );
      }
      return false;
    });
  }
  return true;
}

const db = {
  user: {
    findUnique: async ({ where }) => {
      const row = users.get(where.id);
      return row ? structuredClone(row) : null;
    },
    update: async ({ where, data }) => {
      const row = users.get(where.id);
      if (!row) throw new Error("missing user");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  service: {
    findUnique: async ({ where }) => {
      if (where.id) return structuredClone(services.get(where.id) ?? null);
      if (where.slug) {
        const hit = [...services.values()].find((s) => s.slug === where.slug);
        return hit ? structuredClone(hit) : null;
      }
      return null;
    },
    findMany: async ({ where = {}, orderBy } = {}) => {
      let rows = [...services.values()];
      if (where.isActive !== undefined) {
        rows = rows.filter((r) => Boolean(r.isActive) === where.isActive);
      }
      if (where.isPublished !== undefined) {
        rows = rows.filter((r) => Boolean(r.isPublished) === where.isPublished);
      }
      if (where.id?.in) {
        const allowed = new Set(where.id.in);
        rows = rows.filter((r) => allowed.has(r.id));
      }
      if (Array.isArray(orderBy)) {
        rows.sort((a, b) => {
          for (const rule of orderBy) {
            const [field, dir] = Object.entries(rule)[0];
            const av = a[field] ?? "";
            const bv = b[field] ?? "";
            if (av < bv) return dir === "desc" ? 1 : -1;
            if (av > bv) return dir === "desc" ? -1 : 1;
          }
          return 0;
        });
      }
      return structuredClone(rows);
    },
    create: async ({ data }) => {
      const id = data.id ?? `svc-${++seq}`;
      const row = {
        id,
        currency: "RUB",
        sortOrder: 0,
        isActive: true,
        isPublished: true,
        ...structuredClone(data),
      };
      services.set(id, row);
      return structuredClone(row);
    },
    update: async ({ where, data }) => {
      const row = services.get(where.id);
      if (!row) throw new Error("missing service");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
    delete: async ({ where }) => {
      const row = services.get(where.id);
      if (!row) throw new Error("missing service");
      services.delete(where.id);
      return structuredClone(row);
    },
  },
  order: {
    count: async ({ where } = {}) => {
      if (!where) return orders.size;
      return [...orders.values()].filter((o) =>
        matchesActiveOrderForService(o, where)
      ).length;
    },
    findUnique: async ({ where }) => {
      const row = orders.get(where.id);
      if (!row) return null;
      return structuredClone({
        ...row,
        user: users.get(row.userId) ?? null,
        items: [...orderItems.values()].filter((i) => i.orderId === row.id),
        services: [...orderServices.values()]
          .filter((s) => s.orderId === row.id)
          .map((s) => ({ ...s, service: services.get(s.serviceId) })),
        payments: [],
      });
    },
    create: async ({ data }) => {
      const id = `ord-${++seq}`;
      const { services: svcCreate, items: itemCreate, ...rest } = data;
      const row = {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...structuredClone(rest),
      };
      orders.set(id, row);

      const createdServices = [];
      const svcEntries = Array.isArray(svcCreate?.create)
        ? svcCreate.create
        : svcCreate?.create
          ? [svcCreate.create]
          : [];
      for (const entry of svcEntries) {
        const osRow = {
          id: `os-${++seq}`,
          orderId: id,
          serviceId: entry.serviceId,
          quantity: entry.quantity ?? 1,
        };
        orderServices.set(osRow.id, osRow);
        createdServices.push({
          ...osRow,
          service: structuredClone(services.get(entry.serviceId)),
        });
      }

      const itemEntries = Array.isArray(itemCreate?.create)
        ? itemCreate.create
        : itemCreate?.create
          ? [itemCreate.create]
          : [];
      for (const entry of itemEntries) {
        const oiRow = {
          id: `oi-${++seq}`,
          orderId: id,
          ...structuredClone(entry),
        };
        orderItems.set(oiRow.id, oiRow);
      }

      return structuredClone({
        ...row,
        services: createdServices,
      });
    },
    update: async ({ where, data }) => {
      const row = orders.get(where.id);
      if (!row) throw new Error("missing order");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      const row = orders.get(where.id);
      if (!row || (where.status && row.status !== where.status)) return { count: 0 };
      const successful = (row.payments ?? []).some((payment) => payment.status === "succeeded");
      if (where.payments?.none && successful) return { count: 0 };
      Object.assign(row, structuredClone(data));
      return { count: 1 };
    },
  },
  orderService: {
    create: async ({ data }) => {
      const row = { id: `os-${++seq}`, ...structuredClone(data) };
      orderServices.set(row.id, row);
      return structuredClone(row);
    },
  },
  orderItem: {
    create: async ({ data }) => {
      const row = { id: `oi-${++seq}`, ...structuredClone(data) };
      orderItems.set(row.id, row);
      return structuredClone(row);
    },
    update: async ({ where, data }) => {
      const row = orderItems.get(where.id);
      if (row) Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  activityLog: {
    create: async ({ data }) => {
      logs.push(structuredClone(data));
      return data;
    },
  },
  authSession: {
    updateMany: async () => ({ count: 0 }),
  },
  transaction: async (fn) => fn(db),
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "bcryptjs") return {
    compare: async (password, hash) => password === "current-password" && hash === "current-hash",
    hash: async (password) => `hash:${password}`,
  };
  if (name === "@/lib/payload-native") return createNativeModuleMock(db);
  if (name === "@/lib/db") {
    // Публичные чтения услуг идут через собственный SQL-слой: отдаём фикстуры
    // по тем же правилам фильтрации, что и настоящий запрос.
    const real = originalLoad.call(this, path.join(__dirname, "..", "lib", "db.ts"), parent, isMain);
    return {
      ...real,
      rows: async (sql, args = []) => {
        const query = String(sql).replace(/\s+/g, " ");
        // Всё, что не является публичным списком услуг, читает настоящая база:
        // аккаунты, аудит и профиль живут в SQLite.
        if (!query.includes("from services s")) return real.rows(sql, args);
        return [...services.values()]
          .filter((service) => service.isActive && service.isPublished)
          .map((service) => ({
            id: service.id,
            title: service.title,
            slug: service.slug,
            category: service.category,
            short_desc: service.shortDesc ?? "",
            full_desc: service.fullDesc ?? "",
            result_text: service.resultText ?? "",
            cover_image: service.coverImage ?? null,
            cover_url: null,
            base_price: service.basePrice ?? 0,
            price_type: service.priceType ?? "quote",
            currency: service.currency ?? "RUB",
            is_orderable: service.isOrderable ? 1 : 0,
            is_published: service.isPublished ? 1 : 0,
            is_active: service.isActive ? 1 : 0,
            sort_order: service.sortOrder ?? 0,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          }));
      },
    };
  }
  if (name === "@/lib/password-breach") return {
    CompromisedPasswordError: class CompromisedPasswordError extends Error {},
    assertPasswordNotCompromised: async () => {},
  };
  if (name === "@/lib/admin-session") {
    return {
      requireAdmin: async () =>
        admin && (admin.role === "ADMIN" || admin.role === "FOUNDER")
          ? admin
          : null,
      requireStaff: async () =>
        admin
          ? {
              ...admin,
              isAdmin: admin.role === "ADMIN" || admin.role === "FOUNDER",
            }
          : null,
    };
  }
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name === "@/auth") {
    return {
      auth: async () =>
        sessionUser ? { user: { id: sessionUser.id } } : null,
    };
  }
  if (name === "next/cache") {
    return { revalidatePath: (url) => invalidated.push(url) };
  }
  if (name === "next/headers") {
    return {
      cookies: async () => ({ get: () => ({ value: "en" }) }),
      headers: async () => new Map(),
    };
  }
  if (name === "@/lib/uploads") {
    return {
      cleanupUpload: async () => {},
      saveImageUpload: async () => "/uploads/avatars/new.webp",
      UploadValidationError: class UploadValidationError extends Error {},
    };
  }
  if (name === "@/lib/payments/invoice") {
    return {
      issueInvoice: async ({ amount }) => ({
        paymentId: `pay-${++seq}`,
        paymentUrl: null,
        invId: amount,
      }),
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

let database;

/** Аккаунты из `users` живут в настоящей SQLite: профиль и пароль пишутся туда. */
async function mirrorUsers() {
  for (const user of users.values()) {
    await database.insertAccount({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isBlocked: user.isBlocked,
      avatar: user.avatar,
      passwordHash: user.passwordHash ?? null,
    });
  }
}

async function storedUser(id) {
  const row = await database.one("select * from accounts where id = ?", [id]);
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
  };
}

const { GET: getServicesApi } = require("../app/api/services/route.ts");
const { createOrder } = require("../app/actions/orders.ts");
const { changePassword, updateUserProfile } = require("../app/actions/user.ts");

before(async () => {
  database = createTestDatabase("pip-profile-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  seq = 0;
  await database.reset();
  admin = { id: "usr-admin", email: "admin@pip.test", role: "ADMIN" };
  sessionUser = { id: "usr-client" };
  users = new Map([
    [
      "usr-client",
      {
        id: "usr-client",
        email: "client@pip.test",
        firstName: "Ivan",
        lastName: "Petrov",
        avatar: null,
        role: "USER",
        isBlocked: false,
        passwordHash: "current-hash",
      },
    ],
    [
      "usr-blocked",
      {
        id: "usr-blocked",
        email: "blocked@pip.test",
        firstName: "Bad",
        lastName: "Actor",
        avatar: null,
        role: "USER",
        isBlocked: true,
      },
    ],
  ]);
  await mirrorUsers();
  services = new Map([
    [
      "svc-small",
      {
        id: "svc-small",
        title: "Sign Design",
        slug: "sign-design",
        shortDesc: "Facade signage",
        category: "small",
        basePrice: 1_500_000, // 15,000 ₽
        priceType: "from",
        currency: "RUB",
        coverImage: "/assets/shop/sign-design.jpg",
        isActive: true,
        isPublished: true,
        isOrderable: true,
        sortOrder: 1,
      },
    ],
    [
      "svc-large",
      {
        id: "svc-large",
        title: "Highway Billboard",
        slug: "billboard",
        shortDesc: "Arterial road billboard",
        category: "large",
        basePrice: 3_500_000, // 35,000 ₽
        priceType: "from",
        currency: "RUB",
        coverImage: "/assets/shop/billboard.jpg",
        isActive: true,
        isPublished: true,
        isOrderable: true,
        sortOrder: 2,
      },
    ],
    [
      "svc-hidden",
      {
        id: "svc-hidden",
        title: "Archived Service",
        slug: "archived",
        shortDesc: "Hidden",
        category: "small",
        basePrice: 500_000,
        priceType: "from",
        currency: "RUB",
        coverImage: "/assets/shop/sign-design.jpg",
        isActive: false,
        isPublished: false,
        isOrderable: true,
        sortOrder: 3,
      },
    ],
  ]);
  orders = new Map();
  orderItems = new Map();
  orderServices = new Map();
  logs = [];
  invalidated = [];
});

test("GET /api/services returns only active services with basePrice in rubles", async () => {
  const response = await getServicesApi();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.length, 2);
  assert.equal(
    body.some((item) => item.id === "svc-hidden"),
    false
  );
  const sign = body.find((item) => item.id === "svc-small");
  assert.equal(sign.name, "Sign Design");
  assert.equal(sign.basePrice, 15000);
  assert.equal(sign.basePriceKopecks, 1_500_000);
  assert.equal(sign.category, "small");
});

test("createOrder enforces authentication, non-empty services, active services, and valid deadline", async () => {
  // 1. Forbidden without authentication
  sessionUser = null;
  await assert.rejects(() =>
    createOrder({ serviceIds: ["svc-small"], description: "Test" })
  );

  // 2. Forbidden when user is blocked
  sessionUser = { id: "usr-blocked" };
  await assert.rejects(() =>
    createOrder({ serviceIds: ["svc-small"], description: "Test" })
  );

  // 3. HARD CONSTRAINT: Forbidden without selected services
  sessionUser = { id: "usr-client" };
  await assert.rejects(
    () => createOrder({ serviceIds: [], description: "No services" }),
    /select at least one service/i
  );

  // 4. Forbidden for inactive services
  await assert.rejects(
    () => createOrder({ serviceIds: ["svc-hidden"] }),
    /unavailable/i
  );

  // 5. Forbidden for past deadlines
  await assert.rejects(
    () =>
      createOrder({
        serviceIds: ["svc-small"],
        deadline: "2000-01-01",
      }),
    /deadline/i
  );
});

test("createOrder generates ПИП-XXXXXX and persists native service links and unified items", async () => {
  const future = new Date(Date.now() + 3 * 86400000);
  const order = await createOrder({
    serviceIds: ["svc-small", "svc-large"],
    deadline: future,
    description: "Two-sided sign and billboard",
  });
  assert.match(order.orderNumber, /^ПИП-\d{6}$/);
  assert.equal(order.services.length, 2);
  assert.equal(order.estimatedAmount, 5_000_000);
  assert.equal(orders.size, 1);
  assert.equal(orderServices.size, 2);
  assert.equal(orderItems.size, 2);
  assert.ok([...orderItems.values()].every((item) => item.itemType === "service" && item.optionsSnapshot === "[]"));
  assert.equal(logs[0].entityType, "order");
  assert.equal(logs[0].actorId, "usr-client");
});

test("HARD CONSTRAINT: updateUserProfile requires authorization and never mutates email or role", async () => {
  sessionUser = null;
  await assert.rejects(
    () => updateUserProfile({ firstName: "Hacker", lastName: "One" }),
    /log in/i
  );

  sessionUser = { id: "usr-blocked" };
  await assert.rejects(() =>
    updateUserProfile({ firstName: "Blocked", lastName: "User" })
  );

  sessionUser = { id: "usr-client" };
  const updated = await updateUserProfile({
    firstName: "Alexey",
    lastName: "Smirnov",
    // Attempted privilege escalation fields must be ignored:
    role: "FOUNDER",
    email: "founder@pip.test",
    id: "usr-admin",
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.firstName, "Alexey");
  assert.equal(updated.lastName, "Smirnov");

  const stored = await storedUser("usr-client");
  assert.equal(stored.firstName, "Alexey");
  assert.equal(stored.lastName, "Smirnov");
  assert.equal(stored.email, "client@pip.test");
  assert.equal(stored.role, "USER");
});

test("password changes verify the current password, validate the replacement and audit the update", async () => {
  const valid = {
    currentPassword: "current-password",
    newPassword: "a-New-long-passphrase1",
    confirmPassword: "a-New-long-passphrase1",
  };
  await assert.rejects(
    () => changePassword({ ...valid, currentPassword: "wrong-password" }),
    /current password is incorrect/i,
  );
  assert.equal((await storedUser("usr-client")).passwordHash, "current-hash");
  await assert.rejects(
    () => changePassword({ ...valid, confirmPassword: "different-passphrase" }),
    /do not match/i,
  );

  assert.deepEqual(await changePassword(valid), { ok: true });
  assert.equal((await storedUser("usr-client")).passwordHash, "hash:a-New-long-passphrase1");
  const audit = await database.rows("select * from activity_logs where entity_id = 'usr-client' order by created_at");
  assert.equal(audit.at(-1).action, "password changed");
  assert.equal(audit.at(-1).actor_id_id, "usr-client");

  sessionUser = null;
  await assert.rejects(() => changePassword(valid), /log in/i);
});
