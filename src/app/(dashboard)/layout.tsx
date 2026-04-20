import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="min-h-screen overflow-x-clip" style={{ background: "var(--color-bg)" }}>
        <Sidebar />
        {/* paddingLeft tracks --sidebar-width, set by Sidebar via JS (LADR-013) */}
        <main
          className="pb-16 md:pb-0 transition-[padding-left] duration-200"
          style={{ paddingLeft: "var(--sidebar-width, 280px)" }}
        >
          <div className="px-4 py-4 xl:px-6 xl:py-6 w-full min-w-0">{children}</div>
        </main>
        <BottomNav />
      </div>
    </DashboardProvider>
  );
}
