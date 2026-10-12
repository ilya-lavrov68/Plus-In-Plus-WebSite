import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!prisma) {
    return NextResponse.json({ post: null });
  }

  try {
    let post = await prisma.post.findFirst({
      where: { isPublished: true, isFeatured: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        isFeatured: true,
      },
    });

    if (!post) {
      post = await prisma.post.findFirst({
        where: { isPublished: true },
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          isFeatured: true,
        },
      });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Failed to load featured post:", error);
    return NextResponse.json({ post: null });
  }
}
