const COLLECTION_DELEGATES = {
  accounts: "user",
  "pending-logins": "pendingLogin",
  "auth-sessions": "authSession",
  "mfa-backup-codes": "mfaBackupCode",
  "webauthn-credentials": "webAuthnCredential",
  services: "service",
  products: "product",
  media: "media",
  posts: "post",
  "activity-logs": "activityLog",
  "page-views": "pageView",
  orders: "order",
  "order-services": "orderService",
  "order-items": "orderItem",
  payments: "payment",
  "site-settings": "siteSetting",
};

function scalarWhere(condition) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) return condition;
  const output = {};
  for (const [operator, value] of Object.entries(condition)) {
    if (operator === "equals") return value;
    if (operator === "not_equals") output.not = value;
    else if (operator === "less_than") output.lt = value;
    else if (operator === "less_than_equal") output.lte = value;
    else if (operator === "greater_than") output.gt = value;
    else if (operator === "greater_than_equal") output.gte = value;
    else if (operator === "not_in") output.notIn = value;
    else if (operator === "like" && typeof value === "string" && value.endsWith("%")) output.startsWith = value.slice(0, -1);
    else if (operator === "exists") return value ? { not: null } : null;
    else output[operator] = value;
  }
  return output;
}

function nativeWhere(where) {
  if (!where || typeof where !== "object") return where;
  const output = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === "and") {
      for (const clause of value) Object.assign(output, nativeWhere(clause));
    } else if (key === "or") {
      output.OR = value.map(nativeWhere);
    } else {
      output[key] = scalarWhere(value);
    }
  }
  return output;
}

function nativeSort(sort) {
  if (!sort) return undefined;
  const fields = Array.isArray(sort) ? sort : [sort];
  const entries = fields.map((field) => {
    const descending = field.startsWith("-");
    const name = descending ? field.slice(1) : field;
    return { [name]: descending ? "desc" : "asc" };
  });
  return entries.length === 1 ? entries[0] : entries;
}

function idOf(value) {
  if (value && typeof value === "object" && "id" in value) return String(value.id);
  return value === null || value === undefined || value === "" ? null : String(value);
}

/**
 * Test-only Local API double. Production code still sees Payload's native
 * find/create/update/delete/count contract; no Prisma-shaped client is shipped.
 */
function createNativePayloadMock(store) {
  const delegateFor = (collection) => {
    const delegate = store[COLLECTION_DELEGATES[collection]];
    if (!delegate) throw new Error(`Missing test delegate for ${collection}`);
    return delegate;
  };

  const payload = {
    async find(options) {
      const delegate = delegateFor(options.collection);
      const args = {
        where: nativeWhere(options.where),
        orderBy: nativeSort(options.sort),
        select: options.select,
      };
      if (options.limit !== undefined) args.take = options.limit;
      const clauses = options.where?.and ?? [];
      const id = options.where?.id?.equals ?? clauses.find((clause) => clause.id?.equals)?.id.equals;
      let rows;
      if (id !== undefined && delegate.findUnique && !options.where?.and) {
        rows = [await delegate.findUnique({ ...args, where: { id } })].filter(Boolean);
      } else if (delegate.findMany) rows = await delegate.findMany(args);
      else if (delegate.findFirst) rows = [await delegate.findFirst(args)].filter(Boolean);
      else if (delegate.findUnique) rows = [await delegate.findUnique(args)].filter(Boolean);
      else throw new Error(`Missing find for ${options.collection}`);
      if (options.depth > 0 && ["auth-sessions", "pending-logins"].includes(options.collection)) {
        rows = rows.map((row) => row.user ? { ...row, userId: row.user } : row);
      }
      if (options.limit !== undefined) rows = rows.slice(0, options.limit);
      return { docs: rows, totalDocs: rows.length };
    },
    async count(options) {
      const delegate = delegateFor(options.collection);
      return { totalDocs: await delegate.count({ where: nativeWhere(options.where) }) };
    },
    async create(options) {
      const delegate = delegateFor(options.collection);
      return delegate.create({ data: options.data, file: options.file, select: options.select });
    },
    async update(options) {
      const delegate = delegateFor(options.collection);
      if (options.id !== undefined && delegate.update) {
        return delegate.update({ where: { id: options.id }, data: options.data, select: options.select });
      }
      const where = nativeWhere(options.id !== undefined ? { id: { equals: options.id } } : options.where);
      const result = await delegate.updateMany({ where, data: options.data });
      return { docs: Array.from({ length: result.count }, () => ({})) };
    },
    async delete(options) {
      const delegate = delegateFor(options.collection);
      if (options.id !== undefined && delegate.delete) {
        return delegate.delete({ where: { id: options.id } });
      }
      const where = nativeWhere(options.id !== undefined ? { id: { equals: options.id } } : options.where);
      const result = await delegate.deleteMany({ where });
      return { docs: Array.from({ length: result.count }, () => ({})) };
    },
    async findGlobal(options) {
      const delegate = store[options.slug];
      if (!delegate?.findFirst) throw new Error(`Missing global test delegate for ${options.slug}`);
      return delegate.findFirst({ select: options.select });
    },
  };
  return payload;
}

function createNativeModuleMock(store) {
  const payload = createNativePayloadMock(store);
  return {
    getPayloadClient: async () => payload,
    closePayloadClient: async () => undefined,
    payloadId: idOf,
    payloadDate: (value) => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : date;
    },
    isPayloadUniqueError: (error) => {
      const code = String(error?.code ?? "").toUpperCase();
      const message = `${String(error?.message ?? "")} ${String(error?.cause?.message ?? "")}`.toLowerCase();
      return code === "PAYLOAD_UNIQUE_CONSTRAINT" || code.includes("SQLITE_CONSTRAINT") || message.includes("unique") || message.includes("duplicate");
    },
    withPayloadTransaction: async (payloadInstance, callback) => {
      const req = { payload: payloadInstance, context: {}, transactionID: "test-transaction" };
      if (store.transaction) return store.transaction(async () => callback(req));
      return callback(req);
    },
    queryPayloadRows: async (sql, args = []) => store.queryRaw(sql, args),
  };
}

module.exports = { createNativeModuleMock, createNativePayloadMock, nativeWhere };
