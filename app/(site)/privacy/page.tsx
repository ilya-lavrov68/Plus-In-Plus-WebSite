import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title:
      locale === "ru"
        ? "Политика конфиденциальности — Plus In Plus"
        : "Privacy Policy — Plus In Plus",
    description:
      locale === "ru"
        ? "Как студия Plus In Plus обрабатывает проектные брифы, контактные данные клиентов и соблюдает строгую конфиденциальность."
        : "How Plus In Plus handles project briefs, client contact details, and strict studio confidentiality.",
    path: "/privacy",
    locale,
  });
}

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const isRu = locale === "ru";

  return (
    <section style={{ paddingBottom: "var(--block-spacing)" }}>
      <div style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)", maxWidth: "48rem" }}>
        <p className="pl-h6">
          {isRu ? "Правовая информация" : "Legal"}
        </p>
        <h1 className="pl-h1 mt-3">
          {isRu ? "Политика конфиденциальности" : "Privacy Policy"}
        </h1>
        <p className="pl-body mt-4">
          {isRu
            ? "Конфиденциальность — один из базовых принципов студии Plus In Plus. В этом документе описано, какие данные мы собираем при использовании сайта, создании аккаунта или отправке заявки на дизайн."
            : "Confidentiality is one of the core principles of Plus In Plus. This policy explains what data we collect when you use our website, create an account, or submit a design request."}
        </p>

        <hr style={{ borderColor: "var(--theme-border-color)", margin: "2.5rem 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", color: "var(--theme-elevation-750)", lineHeight: 1.7 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h2 className="pl-h3">
              {isRu ? "1. Какие данные мы собираем" : "1. Information We Collect"}
            </h2>
            <p>
              {isRu
                ? "Мы собираем только сведения, необходимые для обработки заявок и выполнения дизайн-проектов: имя, фамилию, адрес электронной почты, выбранные услуги и описания задач, которые вы добровольно отправляете через формы сайта."
                : "We collect only the details necessary to process inquiries and deliver design projects: your first name, last name, email address, selected service options, and project descriptions you voluntarily submit through our forms."}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h2 className="pl-h3">
              {isRu ? "2. Строгая конфиденциальность" : "2. Strict Confidentiality"}
            </h2>
            <p>
              {isRu
                ? "Мы не продаём, не передаём в аренду и не публикуем материалы клиентов. Файлы проекта и детали брифа никогда не передаются третьим лицам за пределами студии Plus In Plus, за исключением проверенных производственных подрядчиков, непосредственно участвующих в выполнении вашего заказа."
                : "We do not sell, rent, or publish client materials. Project files and brief details are never shared outside Plus In Plus other than with trusted production partners directly assisting with your order."}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h2 className="pl-h3">
              {isRu ? "3. Контакты и управление данными" : "3. Contact & Data Requests"}
            </h2>
            <p>
              {isRu ? (
                <>
                  Чтобы обновить или удалить данные своего аккаунта в любое
                  время, свяжитесь с командой студии через страницу «Контакты»
                  или напишите на{" "}
                  <a
                    href="mailto:hello@plusinplus.studio"
                    className="text-foreground underline underline-offset-4"
                  >
                    hello@plusinplus.studio
                  </a>
                  .
                </>
              ) : (
                <>
                  To update or delete your account information at any time,
                  contact our studio team through the Contact page or email{" "}
                  <a
                    href="mailto:hello@plusinplus.studio"
                    className="text-foreground underline underline-offset-4"
                  >
                    hello@plusinplus.studio
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
