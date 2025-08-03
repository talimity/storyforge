import { Bot, Copy, Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const AgentConfigs = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock agent config data
  const agentConfigs = [
    {
      id: 1,
      name: "Default Planner",
      description:
        "General-purpose planning agent for character motivation analysis and scene setup.",
      agentType: "Planner",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
      scenarios: 5,
      lastUsed: "2 hours ago",
      isDefault: true,
    },
    {
      id: 2,
      name: "Fantasy Screenplay",
      description:
        "Specialized screenplay agent optimized for fantasy settings with rich dialogue.",
      agentType: "Screenplay",
      model: "claude-3-sonnet",
      temperature: 0.8,
      maxTokens: 1500,
      scenarios: 3,
      lastUsed: "1 day ago",
      isDefault: false,
    },
    {
      id: 3,
      name: "Elegant Prose",
      description:
        "High-quality prose generation with sophisticated literary style and pacing.",
      agentType: "Prose",
      model: "gpt-4",
      temperature: 0.9,
      maxTokens: 1000,
      scenarios: 7,
      lastUsed: "3 hours ago",
      isDefault: true,
    },
    {
      id: 4,
      name: "Sci-Fi Technical",
      description:
        "Specialized for hard science fiction with accurate technical terminology.",
      agentType: "Prose",
      model: "claude-3-opus",
      temperature: 0.6,
      maxTokens: 1200,
      scenarios: 2,
      lastUsed: "1 week ago",
      isDefault: false,
    },
    {
      id: 5,
      name: "Quick Ranker",
      description:
        "Fast ranking agent for comparing multiple generation outputs.",
      agentType: "Ranking",
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      maxTokens: 500,
      scenarios: 8,
      lastUsed: "1 hour ago",
      isDefault: true,
    },
  ];

  const filteredConfigs = agentConfigs.filter(
    (config) =>
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.agentType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgentTypeColor = (type: string) => {
    switch (type) {
      case "Planner":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Screenplay":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Prose":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Ranking":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const agentTypes = ["All", "Planner", "Screenplay", "Prose", "Ranking"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Agent Configurations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage AI agent settings and prompt templates
          </p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow transition-all">
          <Plus className="w-4 h-4 mr-2" />
          New Agent Config
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search agent configurations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {agentTypes.map((type) => (
            <Badge
              key={type}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10"
            >
              {type}{" "}
              {type === "All"
                ? `(${agentConfigs.length})`
                : `(${agentConfigs.filter((c) => c.agentType === type).length})`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Agent Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredConfigs.map((config) => (
          <Card key={config.id} className="character-card group">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Bot className="w-5 h-5 text-primary" />
                      {config.name}
                    </CardTitle>
                    {config.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  <Badge
                    className={`text-xs w-fit ${getAgentTypeColor(config.agentType)}`}
                  >
                    {config.agentType}
                  </Badge>
                  <CardDescription className="text-sm line-clamp-2 mt-2">
                    {config.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Model and Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Model
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {config.model}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Temperature
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {config.temperature}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Max Tokens
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {config.maxTokens.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Used In
                  </div>
                  <div className="text-sm text-foreground">
                    {config.scenarios} scenarios
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  Last used {config.lastUsed}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Clone
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  {!config.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredConfigs.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No agent configurations found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Create your first agent configuration to customize AI behavior"}
          </p>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create Agent Config
          </Button>
        </div>
      )}
    </div>
  );
};
