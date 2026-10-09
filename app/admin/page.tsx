import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /admin → /admin/dashboard */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
