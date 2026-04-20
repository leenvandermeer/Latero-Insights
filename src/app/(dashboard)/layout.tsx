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
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <Sidebar />
        <main
          className="pb-16 md:pb-0 transition-all duration-200"
          style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
        >
          <div className="px-6 py-6 w-full">{children}</div>
        </main>
        <BottomNav />
      </div>
    </DashboardProvider>
  );
}
