import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!prisma) {
    return NextResponse.json({ post: null });
  }

  try {
    const now = new Date();
    const publishedWindow = {
      isPublished: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    };

    let post = await prisma.post.findFirst({
      where: { ...publishedWindow, isFeatured: true },
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
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
        where: publishedWindow,
        orderBy: [
          { publishedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
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
