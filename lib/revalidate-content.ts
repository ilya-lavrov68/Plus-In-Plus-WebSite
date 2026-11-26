import { revalidatePath } from "next/cache";

/** Public service URLs accept the slug (canonical) and, for legacy links, the id. */
export function revalidateService(id: string, slug?: string) {
  const paths = ["/", "/services", `/services/${id}`, "/contact", "/admin/collections/services", `/admin/collections/services/${id}`, "/admin", "/sitemap.xml"];
  if (slug) paths.push(`/services/${slug}`);
  for (const path of new Set(paths)) {
    revalidatePath(path);
  }
}

export function revalidatePost(id: string, ...slugs: string[]) {
  for (const path of new Set(["/", "/blog", "/admin/collections/posts", `/admin/collections/posts/${id}`, "/admin", "/sitemap.xml", ...slugs.map((slug) => `/blog/${slug}`)])) {
    revalidatePath(path);
  }
}
