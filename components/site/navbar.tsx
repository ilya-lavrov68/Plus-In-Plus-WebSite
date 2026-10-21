import { Navbar10 } from "@/components/blocks/navbar10";
import { getPublishedServices } from "@/lib/data";
import { mergeCatalogServices } from "@/lib/studio-catalog";

export async function Navbar() {
  const dbServices = await getPublishedServices();
  const services = mergeCatalogServices(dbServices);
  return <Navbar10 services={services} />;
}
