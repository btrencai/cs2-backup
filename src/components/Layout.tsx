import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    path: "/",
    label: "仪表盘",
    iconPath:
      "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 14.25 9 9l3 3 5.25-5.25M3 21h18",
  },
  {
    path: "/backups",
    label: "备份",
    iconPath:
      "M20.25 7.5H3.75m16.5 0-.625 10.632A2.25 2.25 0 0 1 17.378 20.25H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m16.5 0A2.25 2.25 0 0 0 18 5.25H6A2.25 2.25 0 0 0 3.75 7.5M9.75 11.25h4.5",
  },
  {
    path: "/auto-cfg",
    label: "Auto.cfg",
    iconPath:
      "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z",
  },
  {
    path: "/settings",
    label: "设置",
    iconPath:
      "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.219.127.325.197.725.23 1.077.089l1.2-.48a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a7.723 7.723 0 0 1 0 .372c-.007.379.138.752.431.992l1.004.827c.424.35.534.955.26 1.431l-1.297 2.247a1.125 1.125 0 0 1-1.37.49l-1.2-.48c-.352-.141-.752-.108-1.077.09-.072.043-.145.085-.22.126-.331.184-.581.496-.644.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a7.633 7.633 0 0 1-.219-.127c-.325-.197-.725-.23-1.077-.089l-1.2.48a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.003-.827c.293-.24.438-.613.431-.992a7.723 7.723 0 0 1 0-.372c.007-.379-.138-.752-.431-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.431l1.297-2.247a1.125 1.125 0 0 1 1.37-.49l1.2.48c.352.141.752.108 1.077-.09.072-.043.145-.085.22-.126.331-.184.581-.496.644-.87l.213-1.281ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
];

function BrandLogo({ className = "cs2-logo" }: { className?: string }) {
  return <img className={className} src="/csgo-icon.svg" alt="CS2" draggable={false} />;
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg className="nav-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="nav-inner">
          <button className="brand" type="button" onClick={() => navigate("/")}>
            <span className="brand-mark">
              <BrandLogo />
            </span>
            <span>
              <span className="brand-title">CS2 Config Backup</span>
              <span className="brand-subtitle">配置备份与快速恢复</span>
            </span>
          </button>

          <div className="nav-tabs" role="navigation" aria-label="主导航">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                <NavIcon path={item.iconPath} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="page">{children}</main>
      <footer className="app-footer">
        <span>CS2 Config Backup v2.2.1</span>
        <span>Copyright © 2026 CS2 Config Backup. All rights reserved.</span>
      </footer>
      <ThemeToggle />
    </div>
  );
}
