import { Link } from "@payloadcms/ui";

export function AdminIcon() {
  return (
    <svg
      className="pip-admin-brand-mark"
      viewBox="0 0 54 42"
      width="54"
      height="42"
      fill="none"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <rect x="12.0039" y="12" width="5.99992" height="5.99992" />
        <rect x="24" y="12" width="5.99992" height="5.99992" />
        <rect y="12" width="5.99992" height="5.99992" />
        <rect x="12.0039" width="5.99992" height="5.99992" />
        <rect x="12.0039" y="23.9995" width="5.99992" height="5.99992" />
      </g>
      <g fill="#8F9CFC">
        <rect x="36" y="12" width="5.99992" height="17.9997" />
        <rect x="36" y="27" width="6" height="15" />
        <rect x="39" y="30" width="6" height="15" transform="rotate(-90 39 30)" />
        <rect x="24" y="30" width="6" height="15" transform="rotate(-90 24 30)" />
      </g>
    </svg>
  );
}

export function AdminLogo({
  className = "pip-admin-login-logo",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 189 42"
      width="189"
      height="42"
      fill="none"
      role="img"
      aria-label="Plus In Plus"
    >
      <g fill="currentColor">
        <rect x="12.0039" y="12" width="5.99992" height="5.99992" />
        <rect x="66" y="12" width="6" height="20" transform="rotate(-90 66 12)" />
        <rect x="70" y="24" width="6" height="16" transform="rotate(-90 70 24)" />
        <rect x="129" y="36" width="6" height="18" transform="rotate(-90 129 36)" />
        <rect x="156" y="36" width="6" height="21" transform="rotate(-90 156 36)" />
        <rect x="159" y="12" width="6" height="21" transform="rotate(-90 159 12)" />
        <rect x="156" y="24" width="6" height="21" transform="rotate(-90 156 24)" />
        <rect x="99" y="36" width="6" height="21" transform="rotate(-90 99 36)" />
        <rect x="66" y="11" width="6" height="25" />
        <rect x="189" y="20.9995" width="1" height="3" transform="rotate(90 189 20.9995)" />
        <rect x="189" y="21.9995" width="2" height="2" transform="rotate(90 189 21.9995)" />
        <rect x="189" y="24.9995" width="1" height="3" transform="rotate(90 189 24.9995)" />
        <rect x="187" y="25.9995" width="2" height="1" transform="rotate(90 187 25.9995)" />
        <rect x="189" y="6.99951" width="3" height="1" transform="rotate(-180 189 6.99951)" />
        <rect x="188" y="10.9995" width="9" height="1" transform="rotate(90 188 10.9995)" />
        <rect x="188" y="9.99951" width="2" height="2" transform="rotate(-180 188 9.99951)" />
        <rect x="189" y="28.9995" width="1" height="3" transform="rotate(90 189 28.9995)" />
        <rect x="187" y="29.9995" width="1" height="1" transform="rotate(90 187 29.9995)" />
        <rect x="189" y="30.9995" width="1" height="3" transform="rotate(90 189 30.9995)" />
        <rect x="189" y="33.9995" width="2" height="1" transform="rotate(90 189 33.9995)" />
        <rect x="188" y="33.9995" width="2" height="1" transform="rotate(-180 188 33.9995)" />
        <rect x="187" y="32.9995" width="2" height="1" transform="rotate(90 187 32.9995)" />
        <rect x="84" y="6" width="5.99992" height="17.9997" />
        <rect x="96" y="6" width="5.99992" height="29.9996" />
        <rect x="126" y="6" width="5.99992" height="29.9996" />
        <rect x="144" y="6" width="5.99992" height="29.9996" />
        <rect x="173.996" y="18" width="5.99992" height="17.9997" />
        <rect x="156" y="6" width="6" height="15" />
        <rect y="12" width="5.99992" height="5.99992" />
        <rect x="12.0039" width="5.99992" height="5.99992" />
        <rect x="12.0039" y="23.9995" width="5.99992" height="5.99992" />
      </g>
      <g fill="#8F9CFC">
        <rect x="36" y="12" width="5.99992" height="17.9997" />
        <rect x="36" y="27" width="6" height="15" />
        <rect x="39" y="30" width="6" height="15" transform="rotate(-90 39 30)" />
        <rect x="24" y="30" width="6" height="15" transform="rotate(-90 24 30)" />
      </g>
    </svg>
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
      <AdminLogo className="pip-admin-nav-brand__logo" />
    </Link>
  );
}
