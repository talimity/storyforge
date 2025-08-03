import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const isScenarioActive = location.pathname.startsWith("/scenario/");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          {!isScenarioActive && (
            <header className="h-14 flex items-center border-b border-border bg-card/50 backdrop-blur-sm px-6">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="ml-4">
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Agentic Narrative Engine
                </h1>
              </div>
            </header>
          )}

          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};
