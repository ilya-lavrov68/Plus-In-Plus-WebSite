import { z } from "zod";

/**
 * Runtime validation for every server action (see README → Security).
 *
 * These schemas are the single source of truth for the accepted shapes; they are
 * deliberately stricter than the database columns, mirroring the limits of the
 * admin forms and the bcrypt/UTF-8 constraints.
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
  .min(1, "Please enter a valid email address.")
  .max(MAX_EMAIL_LENGTH, "Please enter a valid email address.")
  .refine((value) => EMAIL_PATTERN.test(value), "Please enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
  .refine(
    (value) => utf8Bytes(value) <= MAX_PASSWORD_BYTES,
    `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`,
  );

/** Optional human names: no control characters, no runaway length. */
export const optionalNameSchema = z
  .string()
  .trim()
  .max(MAX_NAME_LENGTH, `Names must be at most ${MAX_NAME_LENGTH} characters.`)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), `Names must be at most ${MAX_NAME_LENGTH} characters.`);

export const requiredNameSchema = optionalNameSchema.refine(
  (value) => value.length > 0,
  `Please enter your first and last name (up to ${MAX_NAME_LENGTH} characters each).`,
);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_SLUG_LENGTH, `Slug must be at most ${MAX_SLUG_LENGTH} characters.`)
  .refine(
    (value) => SLUG_PATTERN.test(value),
    "Slug must contain only lowercase letters, numbers and dashes.",
  );

export const registerSchema = z
  .object({
    firstName: requiredNameSchema,
    lastName: requiredNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Passwords do not match."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Required"),
});

export const profileSchema = z.object({
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
});

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, message);
const jsonList = (message: string) =>
  z.array(z.string().trim().min(1).max(500)).min(1, message).max(100, "Use no more than 100 items per list.");

export const createServiceSchema = z.object({
  title: text(160, "Title is required and must be at most 160 characters."),
  /** Optional: derived from the title when the form does not provide one. */
  slug: slugSchema.optional(),
  category: z.enum(["small", "large"], {
    message: 'Category must be "small" or "large".',
  }),
  shortDesc: text(500, "Short description is required (up to 500 characters)."),
  fullDesc: text(100_000, "Full description is required (up to 100,000 characters)."),
  includes: jsonList("Add at least one item to the includes list."),
  shapes: jsonList("Add at least one item to the shapes list."),
  resultText: text(10_000, "Result text is required (up to 10,000 characters)."),
  isPublished: z.boolean(),
});

export const createPostSchema = z.object({
  title: text(160, "Title is required and must be at most 160 characters."),
  slug: slugSchema,
  excerpt: text(500, "Excerpt is required (up to 500 characters)."),
  content: z
    .string()
    .trim()
    .min(1, "Content is required after unsafe HTML is removed.")
    .max(100_000, "Post content is too long."),
  readTime: z
    .number()
    .int("Read time must be between 1 and 1440 minutes.")
    .min(1, "Read time must be between 1 and 1440 minutes.")
    .max(1440, "Read time must be between 1 and 1440 minutes."),
  isPublished: z.boolean(),
  isFeatured: z.boolean().optional().default(false),
  source: z.string().max(50).optional().default("manual"),
  sourceUrl: z.string().max(1000).refine((value) => /^https?:\/\//i.test(value), "Source URL must use http or https.").nullable().optional(),
  images: z.string().nullable().optional(),
  publishedAt: z.date().nullable().optional(),
});

export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateServiceData = z.infer<typeof createServiceSchema>;
export type CreatePostData = z.infer<typeof createPostSchema>;

/** First issue message, so the forms keep showing one human-readable error. */
export function firstIssueMessage(error: z.ZodError, fallback = "Invalid data."): string {
  return error.issues[0]?.message ?? fallback;
}

/** Shared by the actions and the tests: "valid" / first problem as a string. */
export function validate<T>(schema: z.ZodType<T>, value: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: firstIssueMessage(result.error) };
}
