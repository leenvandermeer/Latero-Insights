export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { label: "Overview", href: "/overview", icon: "LayoutDashboard" },
  { label: "Runs", href: "/runs", icon: "Activity" },
  { label: "Data Quality", href: "/quality", icon: "ShieldCheck" },
  { label: "Catalog", href: "/catalog", icon: "Package" },
  { label: "Lineage", href: "/lineage", icon: "GitBranch" },
];
