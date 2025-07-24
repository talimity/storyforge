import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Play,
  Edit,
  Trash2,
  BookOpen,
  Users,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

export const Scenarios = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock scenario data
  const scenarios = [
    {
      id: 1,
      name: "The Autumn Court Intrigue",
      description:
        "A tale of political maneuvering in the fae courts where ancient alliances crumble and new powers rise.",
      characters: ["Lady Veridiana", "Lord Thorn", "The Shadow Broker"],
      turnCount: 23,
      lastPlayed: "2 hours ago",
      created: "1 week ago",
      tags: ["Fantasy", "Political", "Fae"],
    },
    {
      id: 2,
      name: "Space Station Osiris",
      description:
        "Mystery and danger aboard a deep space research station as the crew uncovers a sinister conspiracy.",
      characters: [
        "Dr. Elena Chen",
        "Captain Rodriguez",
        "ARIA",
        "Commander Steel",
      ],
      turnCount: 45,
      lastPlayed: "1 day ago",
      created: "2 weeks ago",
      tags: ["Sci-Fi", "Mystery", "Space"],
    },
    {
      id: 3,
      name: "The Merchant's Gambit",
      description:
        "Trade wars and espionage in a fantasy port city where gold flows like water and secrets are currency.",
      characters: ["Silvana Goldhand", "Captain Blackwater"],
      turnCount: 12,
      lastPlayed: "3 days ago",
      created: "1 month ago",
      tags: ["Fantasy", "Trade", "Intrigue"],
    },
    {
      id: 4,
      name: "The Cyber Heist",
      description:
        "A high-tech thriller in Neo-Tokyo where hackers and megacorps clash in the digital shadows.",
      characters: ["Zero", "Neon", "The Architect"],
      turnCount: 67,
      lastPlayed: "1 week ago",
      created: "2 months ago",
      tags: ["Cyberpunk", "Heist", "Tech"],
    },
    {
      id: 5,
      name: "Dragon's Keep",
      description:
        "Classic fantasy adventure where heroes must navigate ancient dungeons and face legendary beasts.",
      characters: ["Sir Gareth", "Lyra the Mage", "Thorin Ironbeard"],
      turnCount: 0,
      lastPlayed: "Never",
      created: "3 days ago",
      tags: ["Fantasy", "Adventure", "Classic"],
    },
  ];

  const filteredScenarios = scenarios.filter(
    (scenario) =>
      scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Scenarios
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your storytelling scenarios
          </p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow transition-all">
          <Plus className="w-4 h-4 mr-2" />
          New Scenario
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredScenarios.map((scenario) => (
          <Card key={scenario.id} className="character-card group">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-display text-lg truncate">
                      {scenario.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm line-clamp-2">
                    {scenario.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Characters */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Characters ({scenario.characters.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {scenario.characters.slice(0, 3).map((character) => (
                    <Badge
                      key={character}
                      variant="outline"
                      className="text-xs"
                    >
                      {character}
                    </Badge>
                  ))}
                  {scenario.characters.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{scenario.characters.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {scenario.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats and Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="space-y-1">
                  {scenario.turnCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {scenario.turnCount} turns
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {`Last played ${scenario.lastPlayed}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <Link to={`/scenario/${scenario.id}`}>
                    <Button
                      size="sm"
                      className="bg-gradient-primary hover:shadow-glow transition-all"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Continue
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredScenarios.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No scenarios found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Get started by creating your first scenario"}
          </p>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create Scenario
          </Button>
        </div>
      )}
    </div>
  );
};
