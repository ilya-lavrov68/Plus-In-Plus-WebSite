import { randomUUID } from "node:crypto";

import {
  convertLexicalToHTML,
} from "@payloadcms/richtext-lexical/html";
import {
  convertMarkdownToLexical,
  defaultEditorConfig,
  sanitizeServerEditorConfig,
} from "@payloadcms/richtext-lexical";
import {
  type Payload,
  type PayloadRequest,
  type SanitizedConfig,
  type Where,
} from "payload";

import { markdownSource } from "@/lib/post-content-format";
import { getPayloadClient } from "@/lib/payload-native";

export interface PostModel {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  images: string | null;
  readTime: number;
  source: string;
  sourceUrl: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceModel {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc: string;
  fullDesc: string;
  includes: string;
  shapes: string;
  resultText: string;
  coverImage: string;
  isPublished: boolean;
  sortOrder: number;
  basePrice: number;
  priceType: string;
  currency: string;
  isOrderable: boolean;
  isActive: boolean;
  optionGroups: ServiceOptionGroupModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceOptionGroupModel {
  id: string;
  serviceId: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: ServiceOptionModel[];
}

export interface ServiceOptionModel {
  id: string;
  groupId: string;
  label: string;
  priceDelta: number;
  priceFactor: number;
  isDefault: boolean;
  sortOrder: number;
}

type Doc = Record<string, any>;
type Args = Record<string, any>;
type ModelName =
  | "user"
  | "pendingLogin"
  | "authSession"
  | "mfaBackupCode"
  | "webAuthnCredential"
  | "service"
  | "product"
  | "post"
  | "activityLog"
  | "pageView"
  | "order"
  | "orderService"
  | "orderItem"
  | "payment"
  | "siteSetting";

const COLLECTIONS: Record<ModelName, string> = {
  user: "accounts",
  pendingLogin: "pending-logins",
  authSession: "auth-sessions",
  mfaBackupCode: "mfa-backup-codes",
  webAuthnCredential: "webauthn-credentials",
  service: "services",
  product: "products",
  post: "posts",
  activityLog: "activity-logs",
  pageView: "page-views",
  order: "orders",
  orderService: "order-services",
  orderItem: "order-items",
  payment: "payments",
  siteSetting: "site-settings",
};

type Relation = {
  model: ModelName;
  kind: "one" | "many" | "embedded";
  localKey?: string;
  foreignKey?: string;
};

const RELATIONS: Partial<Record<ModelName, Record<string, Relation>>> = {
  user: {
    orders: { model: "order", kind: "many", foreignKey: "userId" },
    managedOrders: { model: "order", kind: "many", foreignKey: "managerId" },
    lockedOrders: { model: "order", kind: "many", foreignKey: "lockedById" },
    activities: { model: "activityLog", kind: "many", foreignKey: "actorId" },
    authSessions: { model: "authSession", kind: "many", foreignKey: "userId" },
    mfaBackupCodes: { model: "mfaBackupCode", kind: "many", foreignKey: "userId" },
    webAuthnCredentials: { model: "webAuthnCredential", kind: "many", foreignKey: "userId" },
    pendingLogins: { model: "pendingLogin", kind: "many", foreignKey: "userId" },
  },
  pendingLogin: { user: { model: "user", kind: "one", localKey: "userId" } },
  authSession: { user: { model: "user", kind: "one", localKey: "userId" } },
  mfaBackupCode: { user: { model: "user", kind: "one", localKey: "userId" } },
  webAuthnCredential: { user: { model: "user", kind: "one", localKey: "userId" } },
  service: {
    optionGroups: { model: "service", kind: "embedded" },
    orderItems: { model: "orderItem", kind: "many", foreignKey: "serviceId" },
    orders: { model: "orderService", kind: "many", foreignKey: "serviceId" },
  },
  product: {
    orderItems: { model: "orderItem", kind: "many", foreignKey: "productId" },
  },
  activityLog: { actor: { model: "user", kind: "one", localKey: "actorId" } },
  order: {
    user: { model: "user", kind: "one", localKey: "userId" },
    manager: { model: "user", kind: "one", localKey: "managerId" },
    lockedBy: { model: "user", kind: "one", localKey: "lockedById" },
    services: { model: "orderService", kind: "many", foreignKey: "orderId" },
    items: { model: "orderItem", kind: "many", foreignKey: "orderId" },
    payments: { model: "payment", kind: "many", foreignKey: "orderId" },
  },
  orderService: {
    order: { model: "order", kind: "one", localKey: "orderId" },
    service: { model: "service", kind: "one", localKey: "serviceId" },
  },
  orderItem: {
    order: { model: "order", kind: "one", localKey: "orderId" },
    service: { model: "service", kind: "one", localKey: "serviceId" },
    product: { model: "product", kind: "one", localKey: "productId" },
  },
  payment: { order: { model: "order", kind: "one", localKey: "orderId" } },
};

const INTERNAL_FIELDS: Partial<Record<ModelName, string[]>> = {
  user: ["avatarMedia", "collection"],
  service: ["cover"],
  product: ["cover"],
  post: ["cover", "gallery"],
  orderService: ["serviceKey"],
  payment: ["providerKey"],
};

const DATE_FIELD = /(?:At|^deadline$)$/;

function idOf(value: unknown): string | null {
  if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id);
  return value === null || value === undefined || value === "" ? null : String(value);
}

function iso(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeDates) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const output: Doc = {};
  for (const [key, entry] of Object.entries(value as Doc)) {
    if (DATE_FIELD.test(key) && typeof entry === "string" && entry) {
      const date = new Date(entry);
      output[key] = Number.isNaN(date.getTime()) ? entry : date;
    } else if (entry && typeof entry === "object") {
      output[key] = normalizeDates(entry);
    } else {
      output[key] = entry;
    }
  }
  return output as T;
}

function scalarSelect(model: ModelName, args: Args): Record<string, boolean> | undefined {
  if (!args.select) return undefined;
  const relations = RELATIONS[model] ?? {};
  const select: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(args.select)) {
    if (key === "_count") continue;
    if (value === true && !relations[key]) select[key] = true;
    if (relations[key]?.kind === "one" && relations[key].localKey) select[relations[key].localKey!] = true;
  }
  if (model === "post") {
    if (args.select.coverImage) select.cover = true;
    if (args.select.images) select.gallery = true;
  }
  if (model === "service" || model === "product") {
    if (args.select.coverImage) select.cover = true;
  }
  if (model === "user" && args.select.avatar) select.avatarMedia = true;
  return select;
}

function orderByToSort(orderBy: unknown): string[] | undefined {
  if (!orderBy) return undefined;
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const sort: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    for (const [field, direction] of Object.entries(entry)) {
      const desc = typeof direction === "string"
        ? direction === "desc"
        : Boolean(direction && typeof direction === "object" && (direction as Doc).sort === "desc");
      sort.push(`${desc ? "-" : ""}${field}`);
    }
  }
  return sort.length ? sort : undefined;
}

function relationOptions(value: unknown): Args {
  return value && typeof value === "object" ? value as Args : {};
}

function requestedRelations(model: ModelName, args: Args): Record<string, Args> {
  const relations = RELATIONS[model] ?? {};
  const requested: Record<string, Args> = {};
  for (const source of [args.include, args.select]) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (key === "_count" || !relations[key] || value === false) continue;
      requested[key] = { ...requested[key], ...relationOptions(value) };
    }
  }
  return requested;
}

function convertScalarCondition(value: unknown): Where {
  if (value === null) return { exists: false } as unknown as Where;
  if (!value || typeof value !== "object" || value instanceof Date || Array.isArray(value)) {
    return { equals: iso(value) } as Where;
  }
  const input = value as Doc;
  const output: Doc = {};
  for (const [operator, operand] of Object.entries(input)) {
    if (operator === "mode") continue;
    if (operator === "in") {
      const values = Array.isArray(operand) ? operand.map(iso) : [iso(operand)];
      if (values.length) output.in = values;
      else output.equals = "__empty_set__";
    } else if (operator === "notIn") {
      const values = Array.isArray(operand) ? operand.map(iso) : [iso(operand)];
      if (values.length) output.not_in = values;
    } else if (operator === "not") {
      if (operand === null) output.exists = true;
      else if (operand && typeof operand === "object" && !Array.isArray(operand)) {
        const nested = convertScalarCondition(operand) as Doc;
        if (nested.equals !== undefined) output.not_equals = nested.equals;
        else if (nested.in !== undefined) output.not_in = nested.in;
      } else output.not_equals = iso(operand);
    } else if (operator === "contains") output.contains = operand;
    else if (operator === "startsWith") output.like = `${String(operand).replaceAll("%", "\\%")}%`;
    else if (operator === "endsWith") output.like = `%${String(operand).replaceAll("%", "\\%")}`;
    else {
      const operators: Record<string, string> = {
        equals: "equals",
        lt: "less_than",
        lte: "less_than_equal",
        gt: "greater_than",
        gte: "greater_than_equal",
      };
      if (operators[operator]) output[operators[operator]] = iso(operand);
    }
  }
  return output as Where;
}

async function lexicalFromString(payload: Payload, value: string): Promise<Doc> {
  const source = markdownSource(value);
  const editorConfig = await sanitizeServerEditorConfig(
    defaultEditorConfig,
    payload.config as SanitizedConfig,
  );
  return convertMarkdownToLexical({ editorConfig, markdown: source }) as Doc;
}

function normalizeError(error: unknown): never {
  if (!error || typeof error !== "object") throw error;
  const typed = error as { code?: string; message?: string; cause?: { message?: string } };
  if (typed.code === "PAYLOAD_UNIQUE_CONSTRAINT") throw error;
  const message = `${typed.message ?? ""} ${typed.cause?.message ?? ""}`;
  if (/unique constraint|duplicate key|already exists|value already registered/i.test(message)) {
    const conflict = new Error("Unique constraint violated", { cause: error }) as Error & { code: string };
    conflict.code = "PAYLOAD_UNIQUE_CONSTRAINT";
    throw conflict;
  }
  throw error;
}

export class PayloadStore {
  readonly user!: ModelDelegate;
  readonly pendingLogin!: ModelDelegate;
  readonly authSession!: ModelDelegate;
  readonly mfaBackupCode!: ModelDelegate;
  readonly webAuthnCredential!: ModelDelegate;
  readonly service!: ModelDelegate;
  readonly product!: ModelDelegate;
  readonly serviceOptionGroup!: ServiceOptionGroupDelegate;
  readonly serviceOption!: ModelDelegate;
  readonly post!: ModelDelegate;
  readonly activityLog!: ModelDelegate;
  readonly pageView!: ModelDelegate;
  readonly order!: ModelDelegate;
  readonly orderService!: ModelDelegate;
  readonly orderItem!: ModelDelegate;
  readonly payment!: ModelDelegate;
  readonly siteSetting!: ModelDelegate;

  constructor(
    private readonly payloadInstance?: Payload,
    private readonly req?: Partial<PayloadRequest>,
  ) {
    for (const model of Object.keys(COLLECTIONS) as ModelName[]) {
      (this as Doc)[model] = new ModelDelegate(this, model);
    }
    this.serviceOptionGroup = new ServiceOptionGroupDelegate(this);
    this.serviceOption = new ModelDelegate(this, "service");
  }

  async payload(): Promise<Payload> {
    return this.payloadInstance ?? getPayloadClient();
  }

  options(): { req?: Partial<PayloadRequest>; overrideAccess: true; showHiddenFields: true } {
    return { overrideAccess: true, showHiddenFields: true, ...(this.req ? { req: this.req } : {}) };
  }

  async transaction<T>(callback: (tx: PayloadStore) => Promise<T>): Promise<T> {
    if (this.req?.transactionID) return callback(this);
    const payload = await this.payload();
    const req = { payload, context: {} } as PayloadRequest;
    const transactionID = await payload.db.beginTransaction();
    if (!transactionID) throw new Error("Payload SQLite transactions are not configured.");
    req.transactionID = transactionID;
    const tx = new PayloadStore(payload, req);
    try {
      const result = await callback(tx);
      await payload.db.commitTransaction(transactionID);
      return result;
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID).catch(() => undefined);
      normalizeError(error);
    }
  }

  async queryRaw<T = Doc>(sql: string, args: unknown[] = []): Promise<T[]> {
    const payload = await this.payload();
    const result = await (payload.db as any).client.execute({
      sql,
      args: args.map((value) => iso(value)) as any[],
    });
    return result.rows as T[];
  }

  async close(): Promise<void> {
    const payload = await this.payload();
    await payload.db.destroy?.();
  }
}

export type PayloadTransactionClient = PayloadStore;
export type PayloadDatabaseClient = PayloadStore;

async function convertWhere(store: PayloadStore, model: ModelName, where: Args | undefined): Promise<Where> {
  if (!where || Object.keys(where).length === 0) return {};
  const clauses: Where[] = [];
  const relations = RELATIONS[model] ?? {};

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "and") {
      const items = Array.isArray(value) ? value : [value];
      const converted = await Promise.all(items.map((item) => convertWhere(store, model, item)));
      if (converted.length) clauses.push({ and: converted });
      continue;
    }
    if (key === "OR" || key === "or") {
      const items = Array.isArray(value) ? value : [value];
      const converted = await Promise.all(items.map((item) => convertWhere(store, model, item)));
      clauses.push({ or: converted.length ? converted : [{ id: { equals: "__empty_set__" } }] });
      continue;
    }
    if (key === "NOT") throw new Error("Top-level NOT is not used by the Payload data layer.");

    if (key === "provider_externalId" && model === "payment") {
      clauses.push(await convertWhere(store, model, value));
      continue;
    }
    if (key === "orderId_serviceId" && model === "orderService") {
      clauses.push(await convertWhere(store, model, value));
      continue;
    }

    const relation = relations[key];
    if (relation && value && typeof value === "object") {
      const filter = (value as Doc).some ?? (value as Doc).is ?? (value as Doc).none;
      const isNone = (value as Doc).none !== undefined;
      if (filter === undefined || relation.kind === "embedded") continue;
      const related = await findRawDocuments(store, relation.model, { where: filter });
      let ids: string[];
      let localField: string;
      if (relation.kind === "one") {
        ids = related.map((doc) => String(doc.id));
        localField = relation.localKey!;
      } else {
        ids = related.map((doc) => idOf(doc[relation.foreignKey!])).filter(Boolean) as string[];
        localField = "id";
      }
      ids = [...new Set(ids)];
      if (isNone) {
        if (ids.length) clauses.push({ [localField]: { not_in: ids } });
      } else {
        clauses.push({ [localField]: ids.length ? { in: ids } : { equals: "__empty_set__" } });
      }
      continue;
    }
    clauses.push({ [key]: convertScalarCondition(value) } as Where);
  }
  if (clauses.length === 1) return clauses[0];
  return { and: clauses };
}

function mapScalarDocument(model: ModelName, input: Doc): Doc {
  const doc: Doc = { ...input };
  for (const relation of Object.values(RELATIONS[model] ?? {})) {
    if (relation.kind === "one" && relation.localKey && doc[relation.localKey] !== undefined) {
      doc[relation.localKey] = idOf(doc[relation.localKey]);
    }
  }

  if (model === "user" && doc.avatarMedia) {
    const url = typeof doc.avatarMedia === "object" ? doc.avatarMedia.url : null;
    if (url) doc.avatar = url;
  }
  if ((model === "service" || model === "product" || model === "post") && doc.cover) {
    const url = typeof doc.cover === "object" ? doc.cover.url : null;
    if (url) doc.coverImage = url;
  }
  if (model === "post") {
    if (doc.content && typeof doc.content === "object" && doc.content.root) {
      doc.content = convertLexicalToHTML({ data: doc.content });
    }
    if (Array.isArray(doc.gallery) && doc.gallery.length) {
      doc.images = JSON.stringify(doc.gallery.map((media: Doc) => media.url).filter(Boolean));
    }
  }
  if (model === "service") {
    if (Array.isArray(doc.includes)) doc.includes = JSON.stringify(doc.includes.map((item: Doc) => item.value).filter((value: unknown) => typeof value === "string"));
    if (Array.isArray(doc.shapes)) doc.shapes = JSON.stringify(doc.shapes.map((item: Doc) => item.value).filter((value: unknown) => typeof value === "string"));
    if (Array.isArray(doc.optionGroups)) {
      doc.optionGroups = doc.optionGroups
        .map((group: Doc) => ({
          ...group,
          serviceId: String(doc.id),
          options: (group.options ?? [])
            .map((option: Doc) => ({ ...option, groupId: String(group.id) }))
            .sort((a: Doc, b: Doc) => a.sortOrder - b.sortOrder),
        }))
        .sort((a: Doc, b: Doc) => a.sortOrder - b.sortOrder);
    }
  }
  for (const key of INTERNAL_FIELDS[model] ?? []) delete doc[key];
  return normalizeDates(doc);
}

async function findRawDocuments(store: PayloadStore, model: ModelName, args: Args = {}): Promise<Doc[]> {
  const payload = await store.payload();
  const where = await convertWhere(store, model, args.where);
  const take = args.take as number | undefined;
  const skip = Math.max(0, Number(args.skip ?? 0));
  if (take !== undefined && take <= 0) return [];
  const options: Args = {
    collection: COLLECTIONS[model],
    depth: 1,
    joins: false,
    sort: orderByToSort(args.orderBy),
    where,
    ...store.options(),
  };
  const select = scalarSelect(model, args);
  if (select) options.select = select;

  if (take === undefined) {
    options.pagination = false;
  } else if (skip > 0 && skip % take === 0) {
    options.limit = take;
    options.page = skip / take + 1;
  } else {
    options.pagination = false;
    options.limit = take + skip;
  }
  const result = await payload.find(options as any);
  let docs = result.docs as Doc[];
  if (take !== undefined && skip > 0 && skip % take !== 0) docs = docs.slice(skip, skip + take);
  return docs.map((doc) => mapScalarDocument(model, doc));
}

async function resolveDocuments(store: PayloadStore, model: ModelName, docs: Doc[], args: Args = {}): Promise<Doc[]> {
  if (!docs.length) return [];
  const requested = requestedRelations(model, args);
  const resolved = docs.map((doc) => ({ ...doc }));
  const relations = RELATIONS[model] ?? {};
  const counts: Record<string, Map<string, number>> = {};

  const countSelect = args.select?._count && typeof args.select._count === "object"
    ? args.select._count.select
    : null;
  if (countSelect) {
    for (const [key, value] of Object.entries(countSelect)) {
      const relation = relations[key];
      if (!relation || relation.kind !== "many" || value === false) continue;
      const options = relationOptions(value);
      const children = await findRawDocuments(store, relation.model, {
        where: {
          AND: [
            { [relation.foreignKey!]: { in: resolved.map((doc) => doc.id) } },
            ...(options.where ? [options.where] : []),
          ],
        },
      });
      const grouped = new Map<string, number>();
      for (const child of children) {
        const parentId = idOf(child[relation.foreignKey!]);
        if (parentId) grouped.set(parentId, (grouped.get(parentId) ?? 0) + 1);
      }
      counts[key] = grouped;
    }
  }

  for (const [key, options] of Object.entries(requested)) {
    const relation = relations[key];
    if (!relation) continue;
    if (relation.kind === "embedded") continue;

    if (relation.kind === "one") {
      const ids = [...new Set(resolved.map((doc) => idOf(doc[relation.localKey!])).filter(Boolean))] as string[];
      if (!ids.length) {
        for (const doc of resolved) doc[key] = null;
        continue;
      }
      const relatedRaw = await findRawDocuments(store, relation.model, {
        where: { AND: [{ id: { in: ids } }, ...(options.where ? [options.where] : [])] },
      });
      const related = await resolveDocuments(store, relation.model, relatedRaw, options);
      const byId = new Map(related.map((doc) => [String(doc.id), doc]));
      for (const doc of resolved) doc[key] = byId.get(idOf(doc[relation.localKey!]) ?? "") ?? null;
      continue;
    }

    const parentIds = resolved.map((doc) => String(doc.id));
    const relatedRaw = await findRawDocuments(store, relation.model, {
      ...options,
      take: undefined,
      skip: undefined,
      where: {
        AND: [
          { [relation.foreignKey!]: { in: parentIds } },
          ...(options.where ? [options.where] : []),
        ],
      },
    });
    const related = await resolveDocuments(store, relation.model, relatedRaw, options);
    const grouped = new Map<string, Doc[]>();
    for (const child of related) {
      const parentId = idOf(child[relation.foreignKey!]);
      if (!parentId) continue;
      const list = grouped.get(parentId) ?? [];
      list.push(child);
      grouped.set(parentId, list);
    }
    for (const doc of resolved) {
      const list = grouped.get(String(doc.id)) ?? [];
      doc[key] = options.take === undefined ? list : list.slice(0, Number(options.take));
    }
  }

  if (!args.select) return resolved;
  return resolved.map((doc) => {
    const projected: Doc = {};
    for (const [key, value] of Object.entries(args.select)) {
      if (key === "_count" || value === false) continue;
      if (key in doc) projected[key] = doc[key];
    }
    if (countSelect) {
      projected._count = {};
      for (const key of Object.keys(countSelect)) projected._count[key] = counts[key]?.get(String(doc.id)) ?? 0;
    }
    return projected;
  });
}

async function prepareData(model: ModelName, input: Args, payload: Payload): Promise<Args> {
  const data: Args = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value !== undefined) data[key] = value instanceof Date ? value.toISOString() : value;
  }
  if (model === "service") {
    for (const key of ["includes", "shapes"]) {
      if (typeof data[key] === "string") {
        try {
          const parsed = JSON.parse(data[key]);
          if (Array.isArray(parsed)) data[key] = parsed.map((value) => ({ value }));
        } catch {
          data[key] = [];
        }
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map((item) => typeof item === "string" ? { value: item } : item);
      }
    }
    if (data.optionGroups?.create) {
      data.optionGroups = data.optionGroups.create.map((group: Doc) => ({
        ...group,
        id: group.id ?? randomUUID(),
        options: (group.options?.create ?? group.options ?? []).map((option: Doc) => ({ ...option, id: option.id ?? randomUUID() })),
      }));
    }
  }
  if (model === "post" && typeof data.content === "string") {
    data.content = await lexicalFromString(payload, data.content);
  }
  return data;
}

function applyUpdateOperators(data: Args, current: Doc): Args {
  const output: Args = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      if ("increment" in value) output[key] = Number(current[key] ?? 0) + Number(value.increment);
      else if ("decrement" in value) output[key] = Number(current[key] ?? 0) - Number(value.decrement);
      else if ("multiply" in value) output[key] = Number(current[key] ?? 0) * Number(value.multiply);
      else if ("divide" in value) output[key] = Number(current[key] ?? 0) / Number(value.divide);
      else if ("set" in value) output[key] = value.set;
      else output[key] = value;
    } else output[key] = value;
  }
  return output;
}

function nestedCreate(value: unknown): Doc[] {
  if (!value || typeof value !== "object") return [];
  const input = value as Doc;
  const created = input.create ?? input.createMany?.data ?? [];
  return Array.isArray(created) ? created : [created];
}

export class ModelDelegate {
  constructor(private readonly store: PayloadStore, private readonly model: ModelName) {}

  async findMany(args: Args = {}): Promise<any[]> {
    const docs = await findRawDocuments(this.store, this.model, args);
    return resolveDocuments(this.store, this.model, docs, args);
  }

  async findFirst(args: Args = {}): Promise<any | null> {
    const docs = await this.findMany({ ...args, take: 1 });
    return docs[0] ?? null;
  }

  async findUnique(args: Args = {}): Promise<any | null> {
    return this.findFirst(args);
  }

  async count(args: Args = {}): Promise<number> {
    const payload = await this.store.payload();
    const where = await convertWhere(this.store, this.model, args.where);
    const result = await payload.count({
      collection: COLLECTIONS[this.model] as any,
      where,
      ...this.store.options(),
    });
    return result.totalDocs;
  }

  async create(args: Args): Promise<any> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const nested: Array<{ relation: string; rows: Doc[] }> = [];
      const inputData = { ...(args.data ?? {}) };
      if (this.model === "order") {
        for (const relation of ["services", "items", "payments"]) {
          const rows = nestedCreate(inputData[relation]);
          if (rows.length) nested.push({ relation, rows });
          delete inputData[relation];
        }
      }
      const data = await prepareData(this.model, inputData, payload);
      try {
        const created = await payload.create({
          collection: COLLECTIONS[this.model] as any,
          data,
          depth: 1,
          ...tx.options(),
        });
        for (const entry of nested) {
          const delegate = entry.relation === "services" ? tx.orderService : entry.relation === "items" ? tx.orderItem : tx.payment;
          for (const row of entry.rows) {
            await delegate.create({ data: { ...row, orderId: created.id } });
          }
        }
        const raw = mapScalarDocument(this.model, created as Doc);
        const [doc] = await resolveDocuments(tx, this.model, [raw], args);
        return doc;
      } catch (error) {
        normalizeError(error);
      }
    });
  }

  async createMany(args: Args): Promise<{ count: number }> {
    return this.store.transaction(async (tx) => {
      const rows = Array.isArray(args.data) ? args.data : [];
      for (const data of rows) await new ModelDelegate(tx, this.model).create({ data });
      return { count: rows.length };
    });
  }

  async update(args: Args): Promise<any> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const [current] = await findRawDocuments(tx, this.model, { where: args.where, take: 1 });
      if (!current) throw new Error("Record to update was not found.");
      const data = await prepareData(this.model, applyUpdateOperators(args.data, current), payload);
      try {
        const updated = await payload.update({
          id: current.id,
          collection: COLLECTIONS[this.model] as any,
          data,
          depth: 1,
          ...tx.options(),
        });
        const raw = mapScalarDocument(this.model, updated as Doc);
        const [doc] = await resolveDocuments(tx, this.model, [raw], args);
        return doc;
      } catch (error) {
        normalizeError(error);
      }
    });
  }

  async updateMany(args: Args): Promise<{ count: number }> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const rows = await findRawDocuments(tx, this.model, { where: args.where });
      for (const current of rows) {
        const data = await prepareData(this.model, applyUpdateOperators(args.data, current), payload);
        await payload.update({
          id: current.id,
          collection: COLLECTIONS[this.model] as any,
          data,
          depth: 0,
          ...tx.options(),
        });
      }
      return { count: rows.length };
    });
  }

  async delete(args: Args): Promise<any> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const [current] = await findRawDocuments(tx, this.model, { where: args.where, take: 1 });
      if (!current) throw new Error("Record to delete was not found.");
      const deleted = await payload.delete({
        id: current.id,
        collection: COLLECTIONS[this.model] as any,
        depth: 1,
        ...tx.options(),
      });
      const raw = mapScalarDocument(this.model, deleted as Doc);
      const [doc] = await resolveDocuments(tx, this.model, [raw], args);
      return doc;
    });
  }

  async deleteMany(args: Args = {}): Promise<{ count: number }> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const rows = await findRawDocuments(tx, this.model, { where: args.where });
      for (const row of rows) {
        await payload.delete({ id: row.id, collection: COLLECTIONS[this.model] as any, depth: 0, ...tx.options() });
      }
      return { count: rows.length };
    });
  }

  async upsert(args: Args): Promise<any> {
    return this.store.transaction(async (tx) => {
      const delegate = new ModelDelegate(tx, this.model);
      const existing = await delegate.findFirst({ where: args.where });
      if (existing) return delegate.update({ where: { id: existing.id }, data: args.update, select: args.select, include: args.include });
      return delegate.create({ data: args.create, select: args.select, include: args.include });
    });
  }

  async groupBy(args: Args): Promise<any[]> {
    const rows = await this.findMany({ where: args.where, orderBy: args.orderBy });
    const by: string[] = args.by ?? [];
    const groups = new Map<string, Doc>();
    for (const row of rows) {
      const key = JSON.stringify(by.map((field) => row[field]));
      if (!groups.has(key)) groups.set(key, Object.fromEntries(by.map((field) => [field, row[field]])));
    }
    return [...groups.values()];
  }

  async aggregate(args: Args = {}): Promise<any> {
    const payload = await this.store.payload();
    const table = COLLECTIONS[this.model].replaceAll("-", "_");
    const selections: string[] = [];
    const output: Doc = {};
    const aggregates = ["_sum", "_avg", "_min", "_max"] as const;
    for (const aggregate of aggregates) {
      const fields = args[aggregate];
      if (!fields) continue;
      output[aggregate] = {};
      for (const field of Object.keys(fields)) {
        if (fields[field] !== true) continue;
        const column = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        const alias = `${aggregate}_${field}`;
        selections.push(`${aggregate.slice(1).toUpperCase()}(\`${column}\`) AS \`${alias}\``);
        output[aggregate][field] = null;
      }
    }
    if (args._count) {
      output._count = {};
      if (args._count._all) selections.push("COUNT(*) AS `_count__all`");
      for (const field of Object.keys(args._count)) {
        if (field === "_all" || args._count[field] !== true) continue;
        const column = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        selections.push(`COUNT(\`${column}\`) AS \`_count_${field}\``);
      }
    }
    if (!selections.length) selections.push("COUNT(*) AS `_count__all`");
    const { sql, values } = aggregateWhere(this.model, args.where);
    const rows = await this.store.queryRaw<Doc>(
      `SELECT ${selections.join(", ")} FROM \`${table}\`${sql}`,
      values,
    );
    const row = rows[0] ?? {};
    for (const aggregate of aggregates) {
      if (!output[aggregate]) continue;
      for (const field of Object.keys(output[aggregate])) {
        const value = row[`${aggregate}_${field}`];
        output[aggregate][field] = value === null || value === undefined ? null : Number(value);
      }
    }
    if (output._count) {
      if (args._count._all) output._count._all = Number(row._count__all ?? 0);
      for (const field of Object.keys(args._count)) {
        if (field !== "_all" && args._count[field] === true) output._count[field] = Number(row[`_count_${field}`] ?? 0);
      }
    }
    return output;
  }
}

function aggregateWhere(model: ModelName, where: Args | undefined): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const allowed = new Set(Object.keys((RELATIONS[model] ? {} : {})));
  void allowed;
  const build = (input: Args): string => {
    const clauses: string[] = [];
    for (const [key, value] of Object.entries(input ?? {})) {
      if (key === "OR" || key === "AND") {
        const parts = (Array.isArray(value) ? value : [value]).map(build).filter(Boolean);
        if (parts.length) clauses.push(`(${parts.join(key === "OR" ? " OR " : " AND ")})`);
        continue;
      }
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error("Invalid aggregate field.");
      const column = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      const condition = (operator: string, operand: unknown) => {
        values.push(iso(operand));
        clauses.push(`\`${column}\` ${operator} ?`);
      };
      if (value === null) clauses.push(`\`${column}\` IS NULL`);
      else if (!value || typeof value !== "object" || value instanceof Date) condition("=", value);
      else {
        for (const [operator, operand] of Object.entries(value as Doc)) {
          if (operator === "equals") condition("=", operand);
          else if (operator === "not") {
            if (operand === null) clauses.push(`\`${column}\` IS NOT NULL`);
            else condition("!=", operand);
          } else if (operator === "gte") condition(">=", operand);
          else if (operator === "gt") condition(">", operand);
          else if (operator === "lte") condition("<=", operand);
          else if (operator === "lt") condition("<", operand);
          else if (operator === "in") {
            const list = Array.isArray(operand) ? operand : [operand];
            if (!list.length) clauses.push("0 = 1");
            else {
              clauses.push(`\`${column}\` IN (${list.map(() => "?").join(",")})`);
              values.push(...list.map(iso));
            }
          }
        }
      }
    }
    return clauses.join(" AND ");
  };
  const sql = where ? build(where) : "";
  return { sql: sql ? ` WHERE ${sql}` : "", values };
}

export class ServiceOptionGroupDelegate {
  constructor(private readonly store: PayloadStore) {}

  async create(args: Args): Promise<any> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const service = await tx.service.findUnique({ where: { id: args.data.serviceId } });
      if (!service) throw new Error("Service not found.");
      const group = {
        ...args.data,
        id: args.data.id ?? randomUUID(),
        options: (args.data.options?.create ?? args.data.options ?? []).map((option: Doc) => ({ ...option, id: option.id ?? randomUUID() })),
      };
      delete group.serviceId;
      const groups = [...(service.optionGroups ?? []), group].map((item: Doc) => {
        const { serviceId: _serviceId, ...groupData } = item;
        return {
          ...groupData,
          options: (item.options ?? []).map((option: Doc) => {
            const { groupId: _groupId, ...rest } = option;
            return rest;
          }),
        };
      });
      await payload.update({
        id: service.id,
        collection: "services",
        data: { optionGroups: groups },
        ...tx.options(),
      });
      return {
        ...group,
        serviceId: service.id,
        options: group.options.map((option: Doc) => ({ ...option, groupId: group.id })),
      };
    });
  }

  async deleteMany(args: Args): Promise<{ count: number }> {
    return this.store.transaction(async (tx) => {
      const payload = await tx.payload();
      const serviceIds = args.where?.serviceId
        ? (Array.isArray(args.where.serviceId.in) ? args.where.serviceId.in : [args.where.serviceId])
        : (await tx.service.findMany({ select: { id: true } })).map((service: Doc) => service.id);
      let count = 0;
      for (const serviceId of serviceIds) {
        const service = await tx.service.findUnique({ where: { id: serviceId } });
        if (!service) continue;
        const groups = service.optionGroups ?? [];
        count += groups.length;
        await payload.update({
          id: service.id,
          collection: "services",
          data: { optionGroups: [] },
          ...tx.options(),
        });
      }
      return { count };
    });
  }
}

export const db = new PayloadStore();
