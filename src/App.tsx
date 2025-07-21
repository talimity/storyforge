import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Characters } from "@/pages/Characters";
import { Scenarios } from "@/pages/Scenarios";
import { ScenarioActive } from "@/pages/ScenarioActive";
import { Lorebooks } from "@/pages/Lorebooks";
import { AgentConfigs } from "@/pages/AgentConfigs";
import { ApiConfigs } from "@/pages/ApiConfigs";
import NotFound from "./pages/NotFound";

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
            <Route path="/lorebooks" element={<Lorebooks />} />
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
