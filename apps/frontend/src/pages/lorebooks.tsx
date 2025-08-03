import {
  BookOpen,
  Edit,
  Eye,
  Hash,
  Plus,
  Scroll,
  Search,
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

export const Lorebooks = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock lorebook data
  const lorebooks = [
    {
      id: 1,
      name: "Autumn Court Codex",
      description:
        "Comprehensive guide to the politics, customs, and history of the Autumn Court of the Fae.",
      entries: 15,
      scenarios: ["The Autumn Court Intrigue"],
      tags: ["Fae", "Politics", "History"],
      lastModified: "2 days ago",
      wordCount: 3420,
    },
    {
      id: 2,
      name: "Space Station Operations Manual",
      description:
        "Technical specifications, protocols, and background information for deep space installations.",
      entries: 23,
      scenarios: ["Space Station Osiris"],
      tags: ["Sci-Fi", "Technical", "Space"],
      lastModified: "1 week ago",
      wordCount: 5680,
    },
    {
      id: 3,
      name: "Port Cities & Trade Networks",
      description:
        "Economic systems, trade routes, and merchant guilds of fantasy maritime civilizations.",
      entries: 8,
      scenarios: ["The Merchant's Gambit"],
      tags: ["Fantasy", "Trade", "Economics"],
      lastModified: "3 days ago",
      wordCount: 2100,
    },
    {
      id: 4,
      name: "Neo-Tokyo Underground",
      description:
        "Street culture, corp politics, and hacker networks in the cyberpunk metropolis.",
      entries: 31,
      scenarios: ["The Cyber Heist"],
      tags: ["Cyberpunk", "Urban", "Tech"],
      lastModified: "1 month ago",
      wordCount: 7890,
    },
  ];

  const filteredLorebooks = lorebooks.filter(
    (lorebook) =>
      lorebook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lorebook.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lorebook.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Lorebooks
          </h1>
          <p className="text-muted-foreground mt-1">
            World-building knowledge and context for your stories
          </p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow transition-all">
          <Plus className="w-4 h-4 mr-2" />
          New Lorebook
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search lorebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-primary/20"
        >
          All ({lorebooks.length})
        </Badge>
      </div>

      {/* Lorebook Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredLorebooks.map((lorebook) => (
          <Card
            key={lorebook.id}
            className="character-card group cursor-pointer"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Scroll className="w-5 h-5 text-accent" />
                    {lorebook.name}
                  </CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {lorebook.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {lorebook.entries} entries
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {lorebook.wordCount.toLocaleString()} words
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {lorebook.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Scenarios */}
              {lorebook.scenarios.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Used in {lorebook.scenarios.length} scenario
                    {lorebook.scenarios.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {lorebook.scenarios.map((scenario) => (
                      <Badge
                        key={scenario}
                        variant="outline"
                        className="text-xs"
                      >
                        {scenario}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  Modified {lorebook.lastModified}
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
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredLorebooks.length === 0 && (
        <div className="text-center py-12">
          <Scroll className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No lorebooks found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Create your first lorebook to store world-building knowledge"}
          </p>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create Lorebook
          </Button>
        </div>
      )}
    </div>
  );
};
