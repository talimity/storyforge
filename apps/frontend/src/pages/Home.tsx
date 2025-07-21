import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Plus, Users, BookOpen, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export const Home = () => {
  // Mock data for recent scenarios
  const recentScenarios = [
    {
      id: 1,
      name: "The Autumn Court Intrigue",
      description: "A tale of political maneuvering in the fae courts",
      characters: ["Lady Veridiana", "Lord Thorn", "The Shadow Broker"],
      lastPlayed: "2 hours ago",
      turnCount: 23
    },
    {
      id: 2,
      name: "Space Station Osiris",
      description: "Mystery and danger aboard a deep space research station",
      characters: ["Dr. Chen", "Captain Rodriguez", "ARIA"],
      lastPlayed: "1 day ago",
      turnCount: 45
    },
    {
      id: 3,
      name: "The Merchant's Gambit",
      description: "Trade wars and espionage in a fantasy port city",
      characters: ["Silvana Goldhand", "Captain Blackwater"],
      lastPlayed: "3 days ago",
      turnCount: 12
    }
  ];

  const quickStats = [
    { label: "Characters", value: "12", icon: Users },
    { label: "Scenarios", value: "8", icon: BookOpen },
    { label: "Active", value: "3", icon: Play },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="font-display text-4xl font-bold text-foreground">
          Welcome to your <span className="text-transparent bg-gradient-primary bg-clip-text">Narrative Engine</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Create immersive stories with AI-powered characters. Act as director, participant, or both.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" className="bg-gradient-primary hover:shadow-glow transition-all">
            <Plus className="w-5 h-5 mr-2" />
            New Scenario
          </Button>
          <Button variant="outline" size="lg">
            <Users className="w-5 h-5 mr-2" />
            Manage Characters
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="bg-surface-elevated border-border/50">
            <CardContent className="flex items-center p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Scenarios */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">Recent Scenarios</h2>
          <Link to="/scenarios">
            <Button variant="ghost" className="text-primary hover:text-primary-glow">
              View All
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {recentScenarios.map((scenario) => (
            <Card key={scenario.id} className="character-card group cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="font-display text-lg">{scenario.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {scenario.description}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {scenario.turnCount} turns
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Characters</div>
                  <div className="flex flex-wrap gap-1">
                    {scenario.characters.map((character) => (
                      <Badge key={character} variant="outline" className="text-xs">
                        {character}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Last played {scenario.lastPlayed}
                  </span>
                  <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-3 h-3 mr-1" />
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="bg-gradient-surface border-border/50">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">1. Import Characters</h4>
              <p className="text-sm text-muted-foreground">
                Import character cards from SillyTavern or create new ones from scratch. Build your character library.
              </p>
              <Link to="/characters">
                <Button variant="outline" size="sm">Manage Characters</Button>
              </Link>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">2. Create Scenarios</h4>
              <p className="text-sm text-muted-foreground">
                Design scenarios, assign characters, and set the stage for immersive storytelling.
              </p>
              <Link to="/scenarios">
                <Button variant="outline" size="sm">Create Scenario</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};