import { Link } from "@payloadcms/ui";

export function AdminIcon() {
  return (
    <span className="pip-admin-brand-mark" aria-hidden="true">
      <img src="/assets/logos/lnpip.svg" alt="" width="54" height="42" />
    </span>
  );
}

export function AdminLogo() {
  return (
    <div className="pip-admin-login-logo">
      <img src="/assets/logos/npip.svg" alt="Plus In Plus" width="189" height="42" />
    </div>
  );
}

export function AdminNavBrand({
  adminRoute,
  dashboardLabel,
}: {
  adminRoute: string;
  dashboardLabel: string;
}) {
  return (
    <Link
      href={adminRoute}
      prefetch={false}
      className="pip-admin-nav-brand"
      aria-label={`Plus In Plus — ${dashboardLabel}`}
    >
      <AdminIcon />
      <span className="pip-admin-nav-brand__copy">
        <strong>Plus In Plus</strong>
        <span>{dashboardLabel}</span>
      </span>
    </Link>
  );
}
