import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";

import { ServiceForm } from "@/components/admin/service-form";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  if (!(await requireAdmin())) redirect("/");
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New service</h1>
      <p className="mt-2 text-muted-foreground">
        The cover is uploaded to /public/uploads/services/ and its path is saved in the database.
      </p>
      <div className="mt-8">
        <ServiceForm mode="create" />
      </div>
    </div>
  );
}
