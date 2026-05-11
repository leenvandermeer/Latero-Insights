import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopBar } from "@/components/navigation/top-bar";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { InstallationProvider } from "@/contexts/installation-context";
import { InstallationGate } from "@/components/navigation/installation-gate";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstallationProvider>
      <DashboardProvider>
        <InstallationGate>
          <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
            <Sidebar />
            <TopBar />
            {/* paddingLeft tracks --sidebar-width, set by Sidebar via JS (LADR-013) */}
            <main
              className="pb-[calc(var(--bottomnav-height)+env(safe-area-inset-bottom,0px))] md:pb-0 pl-0 md:pl-[var(--sidebar-width,280px)] transition-[padding-left] duration-200"
            >
              <div className="w-full min-w-0">
                {children}
              </div>
            </main>
            <BottomNav />
          </div>
        </InstallationGate>
      </DashboardProvider>
    </InstallationProvider>
  );
}
