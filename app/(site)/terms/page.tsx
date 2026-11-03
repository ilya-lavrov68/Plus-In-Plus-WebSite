import type { Metadata } from "next";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title:
      locale === "ru"
        ? "Условия использования — Plus In Plus"
        : "Terms of Use — Plus In Plus",
    description:
      locale === "ru"
        ? "Правила использования сайта, аккаунта и отправки заявок студии Plus In Plus."
        : "Rules for using the Plus In Plus website, accounts, and design request forms.",
    path: "/terms",
    locale,
  });
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const isRu = locale === "ru";

  return (
    <section className="section-y">
      <div className="container max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isRu ? "Правовая информация" : "Legal"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          {isRu ? "Условия использования" : "Terms of Use"}
        </h1>
        <p className="mt-5 max-w-[62ch] text-lg leading-[1.75] text-muted-foreground">
          {isRu
            ? "Эти условия описывают использование сайта Plus In Plus и порядок отправки заявок на услуги студии."
            : "These terms govern use of the Plus In Plus website and requests submitted to the studio."}
        </p>

        <Separator className="my-12" />

        <div className="space-y-10 text-base leading-[1.8] text-muted-foreground">
          <section className="space-y-3.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isRu ? "1. Сайт и аккаунт" : "1. Website and accounts"}
            </h2>
            <p>
              {isRu
                ? "Указывайте достоверные контактные данные, храните пароль в тайне и не передавайте доступ к аккаунту другим лицам. Нельзя пытаться нарушить работу сайта, обойти ограничения доступа или использовать формы для рассылки вредоносного и незаконного содержимого."
                : "Provide accurate contact details, keep your password confidential, and do not share account access. Do not disrupt the website, bypass access controls, or use its forms to submit malicious or unlawful content."}
            </p>
          </section>

          <section className="space-y-3.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isRu ? "2. Заявки, сметы и цены" : "2. Requests, estimates, and pricing"}
            </h2>
            <p>
              {isRu
                ? "Отправка корзины или формы является заявкой на обсуждение проекта, а не автоматическим акцептом или оплатой. Предварительный расчёт на сайте не является окончательной офертой. Состав работ, сроки и цену подтверждает менеджер или основатель после согласования деталей; условия оплаты фиксируются отдельно в счёте или договорённости с клиентом."
                : "Submitting a cart or form is a request to discuss a project, not an automatic acceptance or payment. Website estimates are not final offers. A manager or founder confirms the scope, timing, and price after discussing the details; payment terms are confirmed separately in an invoice or agreement with the client."}
            </p>
          </section>

          <section className="space-y-3.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isRu ? "3. Материалы и результаты работы" : "3. Materials and project deliverables"}
            </h2>
            <p>
              {isRu
                ? "Клиент должен иметь право передавать студии материалы для проекта. Права на исходные материалы остаются у их владельцев. Объём прав на готовый дизайн, исходные файлы и возможность публикации работы в портфолио определяются при согласовании проекта."
                : "Clients must have the right to provide project materials to the studio. Ownership of supplied materials remains with their respective owners. Rights to final designs, source files, and portfolio publication are agreed as part of the project."}
            </p>
          </section>

          <section className="space-y-3.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isRu ? "4. Конфиденциальность и связь с нами" : "4. Privacy and contact"}
            </h2>
            <p>
              {isRu
                ? "Обработка данных описана в Политике конфиденциальности. По вопросам об условиях, заявке или аккаунте свяжитесь с нами через страницу контактов."
                : "Our Privacy Policy explains how data is handled. Contact us with any questions about these terms, a request, or your account."}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/privacy" className="text-foreground underline underline-offset-4">
                {isRu ? "Политика конфиденциальности" : "Privacy Policy"}
              </Link>
              <Link href="/contact" className="text-foreground underline underline-offset-4">
                {isRu ? "Контакты" : "Contact us"}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
