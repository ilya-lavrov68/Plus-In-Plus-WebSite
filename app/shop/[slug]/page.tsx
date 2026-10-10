import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BreadcrumbBack } from "@/components/site/breadcrumb-back";
import { EmptyState } from "@/components/site/empty-state";
import { SafeImage } from "@/components/site/safe-image";
import { NewsCarousel } from "@/components/site/news-carousel";
import { getPublishedPosts, getPublishedService, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  const title = service ? `${service.title} — Plus In Plus` : "Услуги дизайна — Plus In Plus";

  return createPageMetadata({
    title,
    description:
      service?.shortDesc ??
      "Просмотрите подробности услуги и узнайте, что входит в дизайн-проект Plus In Plus.",
    path: `/shop/${encodeURIComponent(slug)}`,
    image: service?.coverImage,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) redirect("/shop");

  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            <BreadcrumbBack href="/shop" label="Back" />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{service.title}</h1>
          </div>
          {/* No order flow yet — placeholder link. */}
          <Link
            href="#"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-12 text-base font-medium text-primary-foreground transition-colors duration-200 ease-out hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Order
          </Link>
        </div>

        {service.coverImage && (
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-lg">
            <SafeImage
              src={service.coverImage}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 1280px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <p className="mt-10 max-w-4xl text-lg leading-relaxed">{service.fullDesc}</p>

        {service.includes.length > 0 && (
          <section aria-labelledby="service-includes" className="mt-12 max-w-4xl">
            <h2 id="service-includes" className="text-2xl font-bold tracking-tight">
              Our service includes:
            </h2>
            <ul className="mt-4 space-y-4">
              {service.includes.map((item, index) => (
                <li key={`${item}-${index}`} className="text-lg leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {service.shapes.length > 0 && (
          <section aria-labelledby="service-shapes" className="mt-12 max-w-4xl">
            <h2 id="service-shapes" className="text-2xl font-bold tracking-tight">
              Any shape, any idea
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6">
              {service.shapes.map((shape, index) => (
                <li key={`${shape}-${index}`} className="text-lg leading-relaxed">
                  {shape}
                </li>
              ))}
            </ol>
          </section>
        )}

        {service.resultText && (
          <p className="mt-12 max-w-4xl text-lg leading-relaxed">
            <strong>The result:</strong> {service.resultText}
          </p>
        )}
      </div>

      <section aria-labelledby="service-other-news" className="bg-lavender">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <h2
            id="service-other-news"
            className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Other News
          </h2>
          <div className="mt-10 sm:mt-12">
            {newsItems.length ? (
              <NewsCarousel items={newsItems} label="Other news" />
            ) : (
              <EmptyState
                icon={Newspaper}
                title="No news yet"
                description="Check back later for updates."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
