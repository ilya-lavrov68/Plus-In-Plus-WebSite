import { Blog11, type Blog11Props } from "@/components/blocks/blog11";
import { toBlogCardData } from "@/lib/blog-card";
import { STUDIO_BLOG_POSTS, type CatalogBlogPost } from "@/lib/studio-catalog";

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
  labels?: Pick<
    Blog11Props,
    | "eyebrow"
    | "featuredLabel"
    | "readTimeTemplate"
    | "readLabel"
    | "ctaTitle"
    | "ctaDescription"
    | "ctaAction"
    | "emptyEyebrow"
    | "compact"
    | "featured"
  >;
}

export function BlogSection({
  heading = "News from Plus In Plus",
  description,
  posts = STUDIO_BLOG_POSTS,
  allCategoryLabel,
  categoryLabels,
  emptyTitle,
  emptyDescription,
  asPageHeading = false,
  id,
  labels,
}: BlogSectionProps) {
  return (
    <Blog11
      id={id}
      heading={heading}
      description={description}
      posts={posts.map(toBlogCardData)}
      allCategoryLabel={allCategoryLabel}
      categoryLabels={categoryLabels}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      asPageHeading={asPageHeading}
      {...labels}
    />
  );
}
