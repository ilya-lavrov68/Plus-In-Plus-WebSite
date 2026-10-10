import { notFound } from "next/navigation";

import { ServiceForm } from "@/components/admin/service-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!prisma) {
    notFound();
  }

  const service = await prisma.service.findUnique({ where: { id } }).catch(() => null);
  if (!service) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit service</h1>
      <p className="mt-2 text-muted-foreground">
        The cover is uploaded to /public/uploads/services/ and its path is saved in the database.
      </p>
      <div className="mt-8">
        <ServiceForm
          mode="edit"
          serviceId={service.id}
          initial={{
            title: service.title,
            category: service.category,
            shortDesc: service.shortDesc,
            fullDesc: service.fullDesc,
            includes: Array.isArray(service.includes)
              ? service.includes.filter((item: unknown): item is string => typeof item === "string")
              : [],
            shapes: Array.isArray(service.shapes)
              ? service.shapes.filter((item: unknown): item is string => typeof item === "string")
              : [],
            resultText: service.resultText,
            coverImage: service.coverImage,
            isPublished: service.isPublished,
          }}
        />
      </div>
    </div>
  );
}
