import { notFound } from "next/navigation";

import { Blog11 } from "@/components/blocks/blog11";
import { Blogpost11 } from "@/components/blocks/blogpost11";
import { localizeBlogPosts } from "@/lib/blog-localization";
import { getPublishedPosts } from "@/lib/data";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { mergeCatalogPosts } from "@/lib/studio-catalog";

export default async function BlogPostContent({ slug }: { slug: string }) {
  const [dbPosts, locale, t] = await Promise.all([
    getPublishedPosts(),
    getRequestLocale(),
    getRequestTranslations("blog"),
  ]);
  const allPosts = localizeBlogPosts(mergeCatalogPosts(dbPosts), t, locale);

  const index = allPosts.findIndex((item) => item.slug === slug);
  if (index === -1) {
    notFound();
  }

  const post = allPosts[index];
  const previousPost =
    index < allPosts.length - 1 ? allPosts[index + 1] : null;
  const nextPost = index > 0 ? allPosts[index - 1] : null;
  const otherPosts = allPosts.filter((item) => item.slug !== post.slug);

  const tBlog = t;
  return (
    <>
      <Blogpost11
        post={post}
        previousPost={previousPost}
        nextPost={nextPost}
        previousLabel={tBlog("previous")}
        nextLabel={tBlog("next")}
        navigationLabel={tBlog("articleNavigation")}
      />
      <Blog11
        id="post-other-news"
        heading={tBlog("otherNews")}
        description={tBlog("otherNewsDescription")}
        posts={otherPosts.length > 0 ? otherPosts : allPosts}
        allCategoryLabel={tBlog("allCategory")}
        categoryLabels={{
          Design: tBlog("categoryDesign"),
          Studio: tBlog("categoryStudio"),
          Outdoor: tBlog("categoryOutdoor"),
        }}
      />
    </>
  );
}
