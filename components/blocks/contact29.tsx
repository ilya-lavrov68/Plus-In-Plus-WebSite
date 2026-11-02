"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  Frame,
  Globe,
  Layers,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ContactGridColumn } from "@/components/site/page-geometry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STUDIO_SERVICES, type CatalogServiceItem } from "@/lib/studio-catalog";

export interface Contact29Props {
  title?: string;
  initialService?: string;
  services?: CatalogServiceItem[];
}

interface TopicOption {
  id: string;
  serviceId?: string;
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const SLUG_ICONS: Record<string, LucideIcon> = {
  "sign-design": Frame,
  "bag-design": ShoppingBag,
  "outdoor-glass-poster": Layers,
  "banner-design": Sparkles,
  "large-billboard": Building2,
  "large-billboard-building": Building2,
  "rooftop-advertising": Globe,
  "advertisement-on-the-fence": Layers,
  billboard: Compass,
};

const EXTRA_STUDIO_TOPICS: TopicOption[] = [
  {
    id: "website-mockups",
    slug: "website-mockups",
    title: "Website & brand mockups",
    description:
      "Stylish, clear visual packaging for digital products and launches",
    icon: Layers,
  },
  {
    id: "general-inquiry",
    slug: "general-inquiry",
    title: "Custom / Other inquiry",
    description:
      "Tell us your idea and we will recommend the best format & budget",
    icon: MessageSquare,
  },
];

const Contact29 = ({
  title = "Contact us",
  initialService,
  services = STUDIO_SERVICES,
}: Contact29Props) => {
  const { data: session } = useSession();
  const t = useTranslations("contact");

  const allOptions = useMemo<TopicOption[]>(() => {
    const mappedServices: TopicOption[] = services.map((service) => ({
      id: service.slug,
      serviceId: service.id,
      slug: service.slug,
      title: service.title,
      description: service.shortDesc,
      icon:
        SLUG_ICONS[service.slug] ??
        (service.category === "large" ? Building2 : Sparkles),
    }));

    return [...mappedServices, ...EXTRA_STUDIO_TOPICS];
  }, [services]);

  const primaryOptions = useMemo(() => allOptions.slice(0, 4), [allOptions]);
  const secondaryOptions = useMemo(() => allOptions.slice(4), [allOptions]);

  const [selectedTopic, setSelectedTopic] = useState<string>(
    initialService || allOptions[0]?.id || "sign-design"
  );
  const [step, setStep] = useState<"select" | "form" | "success">(
    initialService ? "form" : "select"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    setFirstName((prev) => prev || session.user.firstName || "");
    setLastName((prev) => prev || session.user.lastName || "");
    setEmail((prev) => prev || session.user.email || "");
  }, [session?.user]);

  const activeOption =
    allOptions.find(
      (item) => item.id === selectedTopic || item.serviceId === selectedTopic
    ) ?? allOptions[0];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setRequiresAuth(false);
    setSubmitting(true);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          subject: activeOption.title,
          serviceSlug: activeOption.slug,
          serviceId: activeOption.serviceId,
          message: message.trim(),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setRequiresAuth(response.status === 401);
        setError(t(response.status === 401 ? "loginRequired" : "validationError"));
        setSubmitting(false);
        return;
      }

      setOrderNumber(payload?.orderNumber ?? null);
      setStep("success");
    } catch {
      setError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative isolate overflow-hidden py-24 md:py-32">
      <ContactGridColumn />
      <div className="container">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto max-w-5xl"
            >
              <div className="text-center">
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  {title}
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  {t("chooseService")}
                </p>
              </div>

              {/* 4 основных карточки услуг сверху (2 колонки) */}
              <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {primaryOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.id === activeOption?.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedTopic(option.id)}
                      className={`flex flex-col items-start gap-3 rounded-none border p-6 text-left transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-foreground/[0.04] ${
                        selected
                          ? "border-primary bg-primary/[0.07]"
                          : "border-border bg-card/60"
                      }`}
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary">
                        <Icon className="size-5 text-foreground" />
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {option.title}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Остальные услуги из БД в компактных карточках поменьше в 3 колонки снизу */}
              {secondaryOptions.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {secondaryOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = option.id === activeOption?.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedTopic(option.id)}
                        className={`flex flex-col items-start gap-2 rounded-none border p-4 text-left transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-foreground/[0.04] ${
                          selected
                            ? "border-primary bg-primary/[0.07]"
                            : "border-border bg-card/45"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                            <Icon className="size-4 text-foreground" />
                          </div>
                          <div className="text-sm leading-snug font-semibold text-foreground">
                            {option.title}
                          </div>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  type="button"
                  onClick={() => setStep("form")}
                  className="group"
                >
                  {t("continue")}
                  <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16"
            >
              <div className="flex flex-col justify-between lg:col-span-5">
                <div>
                  <button
                    type="button"
                    onClick={() => setStep("select")}
                    className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    <ArrowLeft className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
                    {t("changeSelection")}
                  </button>

                  <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                    {t("projectDescription")}
                  </p>

                  <div className="mt-8 rounded-none border border-border bg-card p-5">
                    <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {t("selectedService")}
                    </div>
                    <div className="mt-1.5 text-base font-semibold text-foreground">
                      {activeOption.title}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeOption.description}
                    </p>
                  </div>
                </div>

                <div className="mt-8 text-sm text-muted-foreground">
                  {t("studioSupport")}{" "}
                  <a
                    href="mailto:hello@plusinplus.studio"
                    className="text-foreground underline underline-offset-4"
                  >
                    hello@plusinplus.studio
                  </a>
                </div>
              </div>

              <div className="lg:col-span-7">
                <form
                  onSubmit={handleSubmit}
                  className="space-y-6 rounded-none border border-border bg-card p-6 md:p-10"
                >
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-first-name">{t("firstName")}</Label>
                      <Input
                        id="contact-first-name"
                        name="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={t("firstNamePlaceholder")}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-last-name">{t("lastName")}</Label>
                      <Input
                        id="contact-last-name"
                        name="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={t("lastNamePlaceholder")}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-email">{t("email")}</Label>
                    <Input
                      id="contact-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-message">{t("message")}</Label>
                    <Textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("messagePlaceholder")}
                      required
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  {requiresAuth ? (
                    <Button asChild variant="outline" className="mb-3 w-full sm:w-auto">
                      <Link href="/login">{t("loginToSend")}</Link>
                    </Button>
                  ) : null}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full sm:w-auto sm:px-10"
                  >
                    {submitting ? t("sending") : t("send")}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto max-w-lg rounded-none border border-border bg-card p-10 text-center"
            >
              <CheckCircle2 className="mx-auto size-12 text-foreground" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">
                {t("messageSent")}
              </h2>
              {orderNumber && (
                <p className="mt-2 text-sm font-medium text-foreground">
                  {t("requestNumber", { number: orderNumber })}
                </p>
              )}
              <p className="mt-3 text-base text-muted-foreground">
                {t("thankYou")}
              </p>
              <Button
                className="mt-8"
                variant="outline"
                onClick={() => {
                  setMessage("");
                  setOrderNumber(null);
                  setStep("form");
                }}
              >
                {t("sendAnother")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export { Contact29 };
