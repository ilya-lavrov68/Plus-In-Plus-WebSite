import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getPayloadClient } from "@/lib/payload-native";
import type { Post } from "@/payload/payload-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getPayloadClient();
    const publishedClauses: Where[] = [{ isPublished: { equals: true } }, { or: [{ publishedAt: { exists: false } }, { publishedAt: { less_than_equal: new Date().toISOString() } }] }];
    const published: Where = { and: publishedClauses };
    const find = (featured: boolean) => payload.find({
      collection: "posts",
      depth: 1,
      limit: 1,
      sort: ["-publishedAt", "-createdAt"],
      overrideAccess: true,
      where: featured ? { and: [{ isFeatured: { equals: true } }, ...publishedClauses] } : published,
    });
    let result = await find(true);
    if (!result.docs.length) result = await find(false);
    const post = result.docs[0] as Post | undefined;
    return NextResponse.json({
      post: post ? {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImage: post.coverImage ?? (typeof post.cover === "object" ? post.cover?.url : null),
        isFeatured: post.isFeatured,
      } : null,
    });
  } catch (error) {
    console.error("Failed to load featured post:", error);
    return NextResponse.json({ post: null });
  }
}
