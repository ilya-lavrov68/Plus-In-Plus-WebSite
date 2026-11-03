import { NextResponse } from "next/server";

import { getFeaturedPostModel } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const post = await getFeaturedPostModel();
    return NextResponse.json({
      post: post ? {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        isFeatured: post.isFeatured === true,
      } : null,
    });
  } catch (error) {
    console.error("Failed to load featured post:", error);
    return NextResponse.json({ post: null });
  }
}
