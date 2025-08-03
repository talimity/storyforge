import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgentConfigs } from "@/pages/agent-configs";
import { ApiConfigs } from "@/pages/api-configs";
import { Characters } from "@/pages/characters";
import { Home } from "@/pages/home";
import { ScenarioActive } from "@/pages/scenario-active";
import { Scenarios } from "@/pages/scenarios";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/scenario/:id" element={<ScenarioActive />} />
            <Route path="/agents" element={<AgentConfigs />} />
            <Route path="/api" element={<ApiConfigs />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
