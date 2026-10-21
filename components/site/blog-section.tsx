import { Blog11 } from "@/components/blocks/blog11";
import type { CatalogBlogPost } from "@/lib/studio-catalog";

interface BlogSectionProps {
  heading?: string;
  description?: string;
  posts?: CatalogBlogPost[];
  asPageHeading?: boolean;
  id?: string;
}

export function BlogSection({
  heading = "News from Plus In Plus",
  description,
  posts,
  asPageHeading = false,
  id,
}: BlogSectionProps) {
  return (
    <Blog11
      id={id}
      heading={heading}
      description={description}
      posts={posts}
      asPageHeading={asPageHeading}
    />
  );
}
