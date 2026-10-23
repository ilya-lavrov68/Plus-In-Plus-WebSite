import { z } from "zod";

/**
 * Runtime validation for every server action (see README → Security).
 *
 * These schemas are the single source of truth for the accepted shapes; they are
 * deliberately stricter than the database columns, mirroring the limits of the
 * admin forms and the bcrypt/UTF-8 constraints.
 *
 * Messages are **translation keys** of the `actions.validation.*` namespace in
 * `messages/en.json` and `messages/ru.json` (for example `validation.titleRequired`).
 * The server actions translate them with `getActionTranslator()` before the text
 * reaches the interface, so a validation error is shown in the visitor's language.
 * The numeric limits in those messages mirror the exported constants below
 * (`MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_BYTES`, `MAX_NAME_LENGTH`, `MAX_SLUG_LENGTH`);
 * `tests/i18n.test.cjs` fails when the two drift apart.
 */

export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 12;
/** bcrypt silently truncates anything beyond 72 bytes. */
export const MAX_PASSWORD_BYTES = 72;
export const MAX_NAME_LENGTH = 80;
export const MAX_SLUG_LENGTH = 120;

const encoder = new TextEncoder();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validation.email")
  .max(MAX_EMAIL_LENGTH, "validation.email")
  .refine((value) => EMAIL_PATTERN.test(value), "validation.email");

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "validation.passwordTooShort")
  .refine(
    (value) => utf8Bytes(value) <= MAX_PASSWORD_BYTES,
    "validation.passwordTooLong",
  );

/** Optional human names: no control characters, no runaway length. */
export const optionalNameSchema = z
  .string()
  .trim()
  .max(MAX_NAME_LENGTH, "validation.nameTooLong")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "validation.nameTooLong");

export const requiredNameSchema = optionalNameSchema.refine(
  (value) => value.length > 0,
  "validation.nameRequired",
);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_SLUG_LENGTH, "validation.slugTooLong")
  .refine(
    (value) => SLUG_PATTERN.test(value),
    "validation.slugPattern",
  );

export const registerSchema = z
  .object({
    firstName: requiredNameSchema,
    lastName: requiredNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "validation.passwordsDoNotMatch"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required"),
});

export const profileSchema = z.object({
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
});

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, message);
const jsonList = (message: string) =>
  z.array(z.string().trim().min(1).max(500)).min(1, message).max(100, "validation.listTooLong");

export const createServiceSchema = z.object({
  title: text(160, "validation.titleRequired"),
  /** Optional: derived from the title when the form does not provide one. */
  slug: slugSchema.optional(),
  category: z.enum(["small", "large"], {
    message: "validation.categoryInvalid",
  }),
  shortDesc: text(500, "validation.shortDescriptionRequired"),
  fullDesc: text(100_000, "validation.fullDescriptionRequired"),
  includes: jsonList("validation.includesRequired"),
  shapes: jsonList("validation.shapesRequired"),
  resultText: text(10_000, "validation.resultRequired"),
  isPublished: z.boolean(),
});

export const createPostSchema = z.object({
  title: text(160, "validation.titleRequired"),
  slug: slugSchema,
  excerpt: text(500, "validation.excerptRequired"),
  content: z
    .string()
    .trim()
    .min(1, "validation.contentRequired")
    .max(100_000, "validation.contentTooLong"),
  readTime: z
    .number()
    .int("validation.readTimeRange")
    .min(1, "validation.readTimeRange")
    .max(1440, "validation.readTimeRange"),
  isPublished: z.boolean(),
  isFeatured: z.boolean().optional().default(false),
  source: z.string().max(50).optional().default("manual"),
  sourceUrl: z.string().max(1000).refine((value) => /^https?:\/\//i.test(value), "validation.sourceUrlProtocol").nullable().optional(),
  images: z.string().nullable().optional(),
  publishedAt: z.date().nullable().optional(),
});

export const createOrderSchema = z.object({
  serviceIds: z
    .array(z.string().trim().min(1).max(128))
    .min(1, "selectAtLeastOneService")
    .max(50, "invalidData"),
  deadline: z.union([z.date(), z.string()]).nullable().optional(),
  description: z.string().max(4000).optional(),
});

export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateServiceData = z.infer<typeof createServiceSchema>;
export type CreatePostData = z.infer<typeof createPostSchema>;
export type CreateOrderData = z.infer<typeof createOrderSchema>;

/**
 * First issue as a translation key (`validation.*`), so the forms keep showing
 * one human-readable error in the language of the request.
 */
export function firstIssueMessage(error: z.ZodError, fallback = "validation.invalidData"): string {
  return error.issues[0]?.message ?? fallback;
}

/** Shared by the actions and the tests: "valid" / first problem as a string. */
export function validate<T>(schema: z.ZodType<T>, value: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: firstIssueMessage(result.error) };
}
