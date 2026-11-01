import type { CollectionConfig, Field } from "payload";

import { ACCOUNTS_SLUG, adminOnly, founderOnly, readAccounts, visibleToAdmin } from "../access.ts";
import { authenticateAuthJsStaff } from "../auth/authjs-strategy.ts";
import { activityAfterChange, cascadeAccountDeletion, protectAccount, protectAccountDeletion, revokeAccountSessions } from "../hooks.ts";

const secretField = (name: string, type: "text" | "date" = "text"): Field => ({
  name,
  type,
  access: { read: () => false, update: () => false },
  admin: { hidden: true },
} as Field);

export const Accounts: CollectionConfig = {
  slug: ACCOUNTS_SLUG,
  labels: {
    singular: { en: "Account", ru: "Аккаунт" },
    plural: { en: "Accounts", ru: "Аккаунты" },
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "firstName", "lastName", "role", "isBlocked", "createdAt"],
    group: { en: "Users", ru: "Пользователи" },
    hidden: ({ user }) => !visibleToAdmin(user),
    components: {
      edit: {
        beforeDocumentControls: ["/payload/components/reset-password-button#ResetPasswordButton"],
      },
    },
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [{ name: "authjs-staff", authenticate: authenticateAuthJsStaff }],
  },
  access: {
    read: readAccounts,
    create: () => false,
    update: adminOnly,
    delete: founderOnly,
  },
  hooks: {
    beforeChange: [protectAccount],
    afterChange: [revokeAccountSessions, activityAfterChange("user", "email")],
    beforeDelete: [protectAccountDeletion, cascadeAccountDeletion],
  },
  fields: [
    { name: "email", type: "email", required: true, unique: true, index: true, access: { update: () => false } },
    secretField("passwordHash"),
    { name: "firstName", type: "text", maxLength: 80, label: { en: "First name", ru: "Имя" } },
    { name: "lastName", type: "text", maxLength: 80, label: { en: "Last name", ru: "Фамилия" } },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "USER",
      options: [
        { label: { en: "Customer", ru: "Клиент" }, value: "USER" },
        { label: { en: "Manager", ru: "Менеджер" }, value: "MANAGER" },
        { label: { en: "Administrator", ru: "Администратор" }, value: "ADMIN" },
        { label: { en: "Founder", ru: "Основатель" }, value: "FOUNDER" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "isBlocked",
      type: "checkbox",
      defaultValue: false,
      label: { en: "Blocked", ru: "Заблокирован" },
      admin: { position: "sidebar" },
    },
    { name: "avatar", type: "text", admin: { hidden: true } },
    {
      name: "avatarMedia",
      type: "upload",
      relationTo: "media",
      label: { en: "Avatar", ru: "Аватар" },
      access: { update: () => false },
    },
    secretField("mfaSecret"),
    secretField("mfaPendingSecret"),
    secretField("mfaPendingCreatedAt", "date"),
    secretField("mfaEnabledAt", "date"),
    secretField("webAuthnRegistrationChallenge"),
    secretField("webAuthnRegistrationChallengeExp", "date"),
  ],
};
