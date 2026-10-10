import { revalidatePath } from "next/cache";

export function revalidateService(id: string) {
  for (const path of ["/", "/shop", `/shop/${id}`, "/admin/services", `/admin/services/${id}`, "/admin/dashboard", "/sitemap.xml"]) {
    revalidatePath(path);
  }
}

export function revalidatePost(id: string, ...slugs: string[]) {
  for (const path of new Set(["/", "/blog", "/shop", "/admin/blog", `/admin/blog/${id}`, "/admin/dashboard", "/sitemap.xml", ...slugs.map((slug) => `/blog/${slug}`)])) {
    revalidatePath(path);
  }
}
