import { Blog11 } from "@/components/blocks/blog11";
import type { CatalogBlogPost } from "@/lib/studio-catalog";

interface BlogSectionProps {
  heading?: string;
  description?: string;
  posts?: CatalogBlogPost[];
  allCategoryLabel?: string;
  categoryLabels?: Partial<Record<CatalogBlogPost["category"], string>>;
  emptyTitle?: string;
  emptyDescription?: string;
  asPageHeading?: boolean;
  id?: string;
}

export function BlogSection({
  heading = "News from Plus In Plus",
  description,
  posts,
  allCategoryLabel,
  categoryLabels,
  emptyTitle,
  emptyDescription,
  asPageHeading = false,
  id,
}: BlogSectionProps) {
  return (
    <Blog11
      id={id}
      heading={heading}
      description={description}
      posts={posts}
      allCategoryLabel={allCategoryLabel}
      categoryLabels={categoryLabels}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      asPageHeading={asPageHeading}
    />
  );
}
