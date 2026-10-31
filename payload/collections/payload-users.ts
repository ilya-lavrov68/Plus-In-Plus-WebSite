import type { CollectionConfig } from "payload";

import { hasPayloadAdmin } from "../access.ts";
import { authenticateAuthJsStaff } from "../auth/authjs-strategy.ts";
import { PAYLOAD_USERS_SLUG } from "../constants.ts";

export const PayloadUsers: CollectionConfig = {
  slug: PAYLOAD_USERS_SLUG,
  labels: {
    singular: { en: "Staff identity", ru: "Служебная учётная запись" },
    plural: { en: "Staff identities", ru: "Служебные учётные записи" },
  },
  admin: { hidden: true },
  auth: {
    disableLocalStrategy: true,
    strategies: [{ name: "authjs-staff", authenticate: authenticateAuthJsStaff }],
  },
  access: {
    read: ({ req }) => hasPayloadAdmin(req),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: "authJsId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "role",
      type: "select",
      required: true,
      options: [
        { label: "Administrator", value: "ADMIN" },
        { label: "Founder", value: "FOUNDER" },
      ],
      admin: { readOnly: true },
    },
  ],
};
