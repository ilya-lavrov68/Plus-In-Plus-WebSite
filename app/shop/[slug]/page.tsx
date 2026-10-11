import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { SafeImage } from "@/components/site/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedPosts, getPublishedService, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ServicePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  const title = service ? `${service.title} — Plus In Plus` : "Shop — Plus In Plus";

  return createPageMetadata({
    title,
    description:
      service?.shortDesc ||
      "Learn the details of this service and what a Plus In Plus design project includes.",
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
  // The gallery shows the service cover image; extra gallery images are not in the data model yet.
  const gallery = [service.coverImage].filter((src): src is string => Boolean(src?.trim()));

  return (
    <>
      <InternalPageHeader title="SHOP" />

      <InternalPageContent labelledBy="service-title">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/shop"
            aria-label="Back to shop"
            className="inline-flex items-center gap-1 justify-self-start rounded-sm text-xl font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <ChevronLeft aria-hidden="true" className="h-6 w-6" />
            Back
          </Link>
          <h2
            id="service-title"
            className="font-geist text-center text-3xl font-normal tracking-tight sm:text-5xl sm:col-start-2"
          >
            {service.title}
          </h2>
          {/* Order goes to the contact form until an order flow exists. */}
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "shrink-0 justify-self-end sm:col-start-3")}
          >
            Order
          </Link>
        </div>

        {gallery.length > 0 && (
          <ul
            aria-label="Service gallery"
            className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
          >
            {gallery.map((src, index) => (
              <li key={`${src}-${index}`} className="relative aspect-video w-[min(85%,640px)] shrink-0 snap-start overflow-hidden rounded-2xl">
                <SafeImage
                  src={src}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 640px, 85vw"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        )}

        {service.fullDesc && (
          <p className="mt-8 max-w-4xl text-lg leading-relaxed">{service.fullDesc}</p>
        )}

        {service.includes.length > 0 && (
          <section aria-labelledby="service-includes" className="mt-12 max-w-4xl">
            <h3 id="service-includes" className="text-2xl font-bold tracking-tight">
              Our service includes:
            </h3>
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
            <h3 id="service-shapes" className="text-2xl font-bold tracking-tight">
              Any shape, any idea
            </h3>
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
      </InternalPageContent>

      <OtherNewsSection items={newsItems} id="service-other-news" />
    </>
  );
}
