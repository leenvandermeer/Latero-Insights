export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Pipelines", href: "/pipelines", icon: "Activity" },
  { label: "Data Quality", href: "/quality", icon: "ShieldCheck" },
  { label: "Datasets", href: "/datasets", icon: "Database" },
  { label: "Lineage", href: "/lineage", icon: "GitBranch" },
  { label: "OpenLineage", href: "/openlineage", icon: "Network" },
];
