import { NavWrapper } from "@payloadcms/next/client";
import { Logout } from "@payloadcms/ui";
import { RenderServerComponent } from "@payloadcms/ui/elements/RenderServerComponent";
import { EntityType, groupNavItems } from "@payloadcms/ui/shared";
import type { EntityToGroup } from "@payloadcms/ui/shared";
import type { PayloadRequest, ServerProps } from "payload";
import { PREFERENCE_KEYS } from "payload/shared";

import { AdminNavBrand } from "./admin-brand.tsx";
import {
  AdminNavClient,
  type AdminNavPreferences,
} from "./admin-nav-client.tsx";

async function getAdminNavPreferences(
  req?: PayloadRequest,
): Promise<AdminNavPreferences | null> {
  if (!req?.user?.collection) return null;
  const result = await req.payload.find({
    collection: "payload-preferences",
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    where: {
      and: [
        { key: { equals: PREFERENCE_KEYS.NAV } },
        { "user.relationTo": { equals: req.user.collection } },
        { "user.value": { equals: req.user.id } },
      ],
    },
  });
  return (result.docs[0]?.value as AdminNavPreferences | undefined) ?? null;
}

export type AdminNavProps = {
  req?: PayloadRequest;
} & ServerProps;

/** Payload nav с теми же permissions/preferences, но фирменными Lucide-иконками. */
export async function AdminNav(props: AdminNavProps) {
  const {
    documentSubViewType,
    i18n,
    locale,
    params,
    payload,
    permissions,
    req,
    searchParams,
    user,
    viewType,
    visibleEntities,
  } = props;

  if (!payload?.config || !visibleEntities || !permissions) return null;

  const {
    admin: {
      components: { afterNav, afterNavLinks, beforeNav, beforeNavLinks, logout },
    },
    collections,
    globals,
  } = payload.config;

  const groups = groupNavItems(
    [
      ...collections
        .filter(({ slug }) => visibleEntities.collections.includes(slug))
        .map(
          (collection) =>
            ({
              type: EntityType.collection,
              entity: collection,
            }) satisfies EntityToGroup,
        ),
      ...globals
        .filter(({ slug }) => visibleEntities.globals.includes(slug))
        .map(
          (global) =>
            ({
              type: EntityType.global,
              entity: global,
            }) satisfies EntityToGroup,
        ),
    ],
    permissions,
    i18n,
  );

  const navPreferences = await getAdminNavPreferences(req);
  const clientProps = { documentSubViewType, viewType };
  const serverProps = {
    i18n,
    locale,
    params,
    payload,
    permissions,
    searchParams,
    user,
  };

  const logoutComponent = RenderServerComponent({
    clientProps,
    Component: logout?.Button,
    Fallback: Logout,
    importMap: payload.importMap,
    serverProps,
  });
  const renderedBeforeNav = RenderServerComponent({
    clientProps,
    Component: beforeNav,
    importMap: payload.importMap,
    serverProps,
  });
  const renderedBeforeNavLinks = RenderServerComponent({
    clientProps,
    Component: beforeNavLinks,
    importMap: payload.importMap,
    serverProps,
  });
  const renderedAfterNavLinks = RenderServerComponent({
    clientProps,
    Component: afterNavLinks,
    importMap: payload.importMap,
    serverProps,
  });
  const renderedAfterNav = RenderServerComponent({
    clientProps,
    Component: afterNav,
    importMap: payload.importMap,
    serverProps,
  });

  return (
    <NavWrapper baseClass="nav">
      {renderedBeforeNav}
      <nav className="nav__wrap pip-admin-nav" aria-label={i18n.t("general:menu")}>
        <AdminNavBrand
          adminRoute={payload.config.routes.admin}
          dashboardLabel={i18n.t("general:dashboard")}
        />
        {renderedBeforeNavLinks}
        <AdminNavClient groups={groups} navPreferences={navPreferences} />
        {renderedAfterNavLinks}
        <div className="nav__controls pip-admin-nav__controls">{logoutComponent}</div>
      </nav>
      {renderedAfterNav}
    </NavWrapper>
  );
}
