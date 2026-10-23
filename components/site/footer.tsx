import { Footer7 } from "@/components/blocks/footer7";
import { getPublishedServices } from "@/lib/data";
import { mergeCatalogServices } from "@/lib/studio-catalog";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function Footer() {
  const [dbServices, t, ta] = await Promise.all([
    getPublishedServices(),
    getRequestTranslations("footer"),
    getRequestTranslations("auth"),
  ]);
  const services = mergeCatalogServices(dbServices);
  const keys = [
    "largeDesigns", "services", "about", "resources", "legal", "company", "aboutLinks.howWeWork",
    "aboutLinks.ourPartners", "aboutLinks.studioNews", "aboutLinks.blog", "companyLinks.account", "companyLinks.contactUs",
    "legalLinks.privacyPolicy", "legalLinks.termsOfUse", "orderDesign", "description", "privacyPolicy",
    "servicesLinks.signDesign", "servicesLinks.bagDesign", "servicesLinks.websiteDesign", "servicesLinks.badgeDesign",
    "servicesLinks.posterDesign", "servicesLinks.bannerMockupDesign", "servicesLinks.largeBillboard", "servicesLinks.rooftopAdvertising",
  ];
  const labels = Object.fromEntries(keys.map((key) => [key, t(key)]));
  labels["auth.register"] = ta("register");
  return <Footer7 services={services} labels={labels} />;
}
