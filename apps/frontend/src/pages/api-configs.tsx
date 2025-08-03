import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Key,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
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

export const ApiConfigs = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock API config data
  const apiConfigs = [
    {
      id: 1,
      name: "OpenAI Production",
      provider: "OpenAI",
      description: "Primary OpenAI API key for production scenarios",
      status: "Active",
      model: "gpt-4",
      rateLimit: "3 RPM",
      lastUsed: "5 minutes ago",
      tokensUsed: 45230,
      monthlyLimit: 100000,
      isDefault: true,
    },
    {
      id: 2,
      name: "Anthropic Claude",
      provider: "Anthropic",
      description: "Claude API for high-quality prose generation",
      status: "Active",
      model: "claude-3-sonnet",
      rateLimit: "5 RPM",
      lastUsed: "1 hour ago",
      tokensUsed: 23100,
      monthlyLimit: 50000,
      isDefault: false,
    },
    {
      id: 3,
      name: "OpenAI Development",
      provider: "OpenAI",
      description: "Development and testing API key with lower limits",
      status: "Inactive",
      model: "gpt-3.5-turbo",
      rateLimit: "20 RPM",
      lastUsed: "2 days ago",
      tokensUsed: 12450,
      monthlyLimit: 25000,
      isDefault: false,
    },
    {
      id: 4,
      name: "Local Ollama",
      provider: "Ollama",
      description: "Local model server for development and testing",
      status: "Error",
      model: "llama2",
      rateLimit: "Unlimited",
      lastUsed: "Never",
      tokensUsed: 0,
      monthlyLimit: null,
      isDefault: false,
    },
  ];

  const filteredConfigs = apiConfigs.filter(
    (config) =>
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "Inactive":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "Error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-success/20 text-success border-success/30";
      case "Inactive":
        return "bg-muted/20 text-muted-foreground border-muted/30";
      case "Error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "OpenAI":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Anthropic":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "Ollama":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30";
    }
  };

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (limit === null) return 0;
    return Math.round((used / limit) * 100);
  };

  const providers = ["All", "OpenAI", "Anthropic", "Ollama"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            API Configurations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys and provider settings
          </p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Add API Config
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search API configurations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {providers.map((provider) => (
            <Badge
              key={provider}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10"
            >
              {provider}{" "}
              {provider === "All"
                ? `(${apiConfigs.length})`
                : `(${apiConfigs.filter((c) => c.provider === provider).length})`}
            </Badge>
          ))}
        </div>
      </div>

      {/* API Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredConfigs.map((config) => (
          <Card key={config.id} className="character-card group">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Key className="w-5 h-5 text-accent" />
                      {config.name}
                    </CardTitle>
                    {config.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs ${getProviderColor(config.provider)}`}
                    >
                      {config.provider}
                    </Badge>
                    <Badge
                      className={`text-xs flex items-center gap-1 ${getStatusColor(config.status)}`}
                    >
                      {getStatusIcon(config.status)}
                      {config.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm line-clamp-2 mt-2">
                    {config.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Model and Rate Limit */}
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
                    Rate Limit
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {config.rateLimit}
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              {config.monthlyLimit && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground uppercase tracking-wide">
                      Monthly Usage
                    </span>
                    <span className="text-foreground">
                      {config.tokensUsed.toLocaleString()} /{" "}
                      {config.monthlyLimit.toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${getUsagePercentage(config.tokensUsed, config.monthlyLimit)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getUsagePercentage(config.tokensUsed, config.monthlyLimit)}
                    % used this month
                  </div>
                </div>
              )}

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
                    <Shield className="w-3 h-3 mr-1" />
                    Test
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
          <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No API configurations found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Add your first API configuration to get started"}
          </p>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Add API Config
          </Button>
        </div>
      )}
    </div>
  );
};
