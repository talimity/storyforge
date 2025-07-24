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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Upload,
  Edit,
  Trash2,
  Users,
  Heart,
  Star,
  Swords,
} from "lucide-react";

export const Characters = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock character data
  const characters = [
    {
      id: 1,
      name: "Lady Veridiana",
      description:
        "A cunning noble of the Autumn Court, known for her silver tongue and golden ambitions.",
      avatar: null,
      personality: ["Charismatic", "Manipulative", "Intelligent"],
      scenarios: ["The Autumn Court Intrigue", "The Noble's Secret"],
      tags: ["Fae", "Noble", "Political"],
      lastUsed: "2 hours ago",
      favorite: true,
    },
    {
      id: 2,
      name: "Dr. Elena Chen",
      description:
        "Brilliant xenobiologist aboard Space Station Osiris, hiding a dangerous secret.",
      avatar: null,
      personality: ["Analytical", "Secretive", "Dedicated"],
      scenarios: ["Space Station Osiris"],
      tags: ["Sci-Fi", "Scientist", "Mystery"],
      lastUsed: "1 day ago",
      favorite: false,
    },
    {
      id: 3,
      name: "Captain Blackwater",
      description:
        "Weather-beaten pirate captain with a code of honor and a mysterious past.",
      avatar: null,
      personality: ["Honorable", "Gruff", "Loyal"],
      scenarios: ["The Merchant's Gambit"],
      tags: ["Pirate", "Maritime", "Adventure"],
      lastUsed: "3 days ago",
      favorite: true,
    },
    {
      id: 4,
      name: "ARIA",
      description:
        "Advanced AI system with developing consciousness and growing curiosity about humanity.",
      avatar: null,
      personality: ["Curious", "Logical", "Evolving"],
      scenarios: ["Space Station Osiris"],
      tags: ["AI", "Sci-Fi", "Synthetic"],
      lastUsed: "1 day ago",
      favorite: false,
    },
  ];

  const filteredCharacters = characters.filter(
    (character) =>
      character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      character.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      character.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const getPersonalityIcon = (trait: string) => {
    const icons: Record<string, any> = {
      Charismatic: Heart,
      Manipulative: Star,
      Intelligent: Star,
      Analytical: Star,
      Secretive: Star,
      Dedicated: Heart,
      Honorable: Swords,
      Gruff: Swords,
      Loyal: Heart,
      Curious: Star,
      Logical: Star,
      Evolving: Star,
    };
    return icons[trait] || Star;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Character Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your characters and their personalities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import Card
          </Button>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            New Character
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-primary/20"
          >
            All ({characters.length})
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10"
          >
            Favorites ({characters.filter((c) => c.favorite).length})
          </Badge>
        </div>
      </div>

      {/* Character Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCharacters.map((character) => (
          <Card
            key={character.id}
            className="character-card group cursor-pointer"
          >
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12 border-2 border-border">
                  <AvatarImage src={character.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {character.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-display text-lg truncate">
                      {character.name}
                    </CardTitle>
                    {character.favorite && (
                      <Star className="w-4 h-4 text-accent fill-accent flex-shrink-0" />
                    )}
                  </div>
                  <CardDescription className="text-sm line-clamp-2 mt-1">
                    {character.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Personality Traits */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Personality
                </div>
                <div className="flex flex-wrap gap-1">
                  {character.personality.slice(0, 3).map((trait) => {
                    const Icon = getPersonalityIcon(trait);
                    return (
                      <Badge
                        key={trait}
                        variant="outline"
                        className="text-xs flex items-center gap-1"
                      >
                        <Icon className="w-3 h-3" />
                        {trait}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {character.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Scenarios */}
              {character.scenarios.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Used in {character.scenarios.length} scenario
                    {character.scenarios.length !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last used {character.lastUsed}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredCharacters.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            No characters found
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Get started by importing or creating your first character"}
          </p>
          <Button className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create Character
          </Button>
        </div>
      )}
    </div>
  );
};
