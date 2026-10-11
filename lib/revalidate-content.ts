import { revalidatePath } from "next/cache";

/** Public service URLs accept the slug (canonical) and, for legacy links, the id. */
export function revalidateService(id: string, slug?: string) {
  const paths = ["/", "/shop", `/shop/${id}`, "/admin/services", `/admin/services/${id}`, "/admin/dashboard", "/sitemap.xml"];
  if (slug) paths.push(`/shop/${slug}`);
  for (const path of new Set(paths)) {
    revalidatePath(path);
  }
}

export function revalidatePost(id: string, ...slugs: string[]) {
  for (const path of new Set(["/", "/blog", "/shop", "/admin/blog", `/admin/blog/${id}`, "/admin/dashboard", "/sitemap.xml", ...slugs.map((slug) => `/blog/${slug}`)])) {
    revalidatePath(path);
  }
}
