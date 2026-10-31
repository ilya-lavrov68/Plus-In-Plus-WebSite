import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /manager → /manager/orders. У менеджера нет сводки по сайту. */
export default function ManagerIndexPage() {
  redirect("/manager/orders");
}
