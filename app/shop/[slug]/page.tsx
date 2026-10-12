import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { OtherNewsSection } from "@/components/site/other-news-section";
import { SafeImage } from "@/components/site/safe-image";
import { getPublishedPosts, getPublishedService, toNewsItem } from "@/lib/data";
import { createPageMetadata } from "@/lib/seo";
import { getServiceArtwork, getServiceGallery, isSignDesignService } from "@/lib/shop-assets";
import { SIGN_DESIGN_COPY } from "@/lib/shop-service-copy";

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
    image: service ? getServiceArtwork(service) : undefined,
  });
}

function copyWithLead(text: string) {
  const separator = text.indexOf(":");
  if (separator > 0 && separator < 64) {
    return (
      <>
        <strong>{text.slice(0, separator + 1)}</strong>
        {text.slice(separator + 1)}
      </>
    );
  }
  return text;
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) redirect("/shop");

  const posts = await getPublishedPosts();
  const newsItems = posts.map(toNewsItem);
  const isReferenceSign = isSignDesignService(service);
  const content = isReferenceSign
    ? SIGN_DESIGN_COPY
    : {
        introduction: service.fullDesc,
        includes: service.includes,
        shapesIntroduction: "",
        shapes: service.shapes,
        result: service.resultText,
      };
  const gallery = getServiceGallery(service);

  return (
    <>
      <InternalPageHeader title="SHOP" />

      <InternalPageContent
        labelledBy="service-title"
        sectionClassName="pt-[clamp(4.5rem,15vw,18rem)] pb-0"
        className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      >
        <article className="mx-auto max-w-[1760px] text-[#052B42]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-5">
            <Link
              href="/shop"
              aria-label="Back to shop"
              className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] sm:text-base"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
              Back
            </Link>
            <h2
              id="service-title"
              className="min-w-0 text-center font-geist text-[clamp(1.55rem,3.6vw,3.5rem)] font-normal leading-tight tracking-[-0.045em]"
            >
              {service.title}
            </h2>
            <Link
              href="/contact"
              className="inline-flex h-11 w-[clamp(7.5rem,19.8vw,23.75rem)] items-center justify-center rounded-xl bg-[#052B42] text-white px-4 font-body text-sm font-semibold transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2 sm:h-14 sm:text-base lg:h-[70px]"
            >
              Order
            </Link>
          </div>

          {gallery.length ? (
            <ul
              aria-label="Service gallery"
              className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:mt-8 sm:gap-6"
            >
              {gallery.map((src, index) => (
                <li
                  key={`${src}-${index}`}
                  className="relative aspect-[3/2] w-[clamp(260px,29vw,560px)] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#F0F0F0]"
                >
                  <SafeImage
                    src={src}
                    alt={`${service.title} example ${index + 1}`}
                    fill
                    priority={index === 0}
                    sizes="(min-width: 1536px) 560px, (min-width: 768px) 29vw, 82vw"
                    className="object-contain"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 space-y-5 font-body text-sm leading-[1.4] sm:mt-6 sm:text-base sm:leading-[1.45]">
            {content.introduction ? <p>{content.introduction}</p> : null}

            {content.includes.length ? (
              <section aria-labelledby="service-includes">
                <h3 id="service-includes" className="font-geist text-lg font-semibold sm:text-xl">
                  Our service includes:
                </h3>
                <ul className="mt-1 space-y-1">
                  {content.includes.map((item, index) => (
                    <li key={`${item}-${index}`}>{copyWithLead(item)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {content.shapes.length ? (
              <section aria-labelledby="service-shapes">
                <h3 id="service-shapes" className="font-geist text-lg font-semibold sm:text-xl">
                  Any shape, any idea
                </h3>
                {content.shapesIntroduction ? <p className="mt-1">{content.shapesIntroduction}</p> : null}
                <ol className="mt-1 list-decimal space-y-0.5 pl-6">
                  {content.shapes.map((shape, index) => (
                    <li key={`${shape}-${index}`}>{shape}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {content.result ? (
              <p>
                <strong>The result:</strong> {content.result}
              </p>
            ) : null}
          </div>
        </article>
      </InternalPageContent>

      <OtherNewsSection items={newsItems} id="service-other-news" />
    </>
  );
}
