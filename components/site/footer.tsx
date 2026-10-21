import { Footer7 } from "@/components/blocks/footer7";
import { getPublishedServices } from "@/lib/data";
import { mergeCatalogServices } from "@/lib/studio-catalog";

export async function Footer() {
  const dbServices = await getPublishedServices();
  const services = mergeCatalogServices(dbServices);
  return <Footer7 services={services} />;
}
