import { Scenario, Lorebook } from "@storyforge/shared";

export const mockScenarios: Scenario[] = [
  {
    id: "scenario-1",
    name: "The Autumn Court Intrigue",
    description: "A tale of political maneuvering in the fae courts",
    characters: ["char-1", "char-2", "char-3"],
    turns: [
      {
        character: null,
        content:
          "The Court of Whispers stands in magnificent splendor, its halls adorned with the colors of autumn. Nobles from across the realm have gathered for what promises to be a pivotal moment in fae politics. The air itself seems to shimmer with anticipation and barely contained magic.",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        character: "char-1",
        content:
          "Lady Veridiana enters the great hall, her emerald gown catching the light of the enchanted chandeliers above. Her presence commands attention, and conversations pause as she moves with calculated grace through the crowd. Every step is deliberate, every glance meaningful.",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        character: "char-1",
        content: `The golden leaves of autumn swirl through the air as Lady Veridiana steps into the Court of Whispers. Her emerald gown rustles softly against the marble floor, each footstep calculated and deliberate. The other nobles watch her approach with a mixture of curiosity and wariness.

"My lords and ladies," she begins, her voice carrying the weight of centuries, "I come before you today with news that will change the very fabric of our realm."

Lord Thorn's eyes narrow from across the chamber. He has suspected her of plotting for weeks, but now his suspicions seem confirmed. The Shadow Broker, meanwhile, observes from the shadows with barely concealed amusement—as if he knows something the others do not.

The tension in the air is palpable as all eyes turn to Lady Veridiana, waiting for her next words.`,
        timestamp: new Date().toISOString(),
        agentData: {
          plannerOutput:
            "Lady Veridiana will reveal critical information while Lord Thorn grows suspicious and the Shadow Broker remains enigmatic",
          screenplayOutput:
            "INT. COURT OF WHISPERS - DAY\nLady Veridiana enters with purpose. Lord Thorn watches suspiciously. The Shadow Broker observes from shadows.",
          proseOutput: "The autumn court scene with building tension",
        },
      },
    ],
  },
];

export const mockLorebooks: Lorebook[] = [
  {
    id: "lore-1",
    name: "The Fae Courts",
    description: "Knowledge about the various fae courts and their politics",
    entries: [
      {
        id: "entry-1",
        trigger: ["Court of Whispers", "fae court", "autumn court"],
        content:
          "The Court of Whispers is one of the four seasonal courts of the fae realm. Known for its political intrigue and the trading of secrets, it meets during the autumn season when the veil between worlds is thinnest.",
        enabled: true,
      },
      {
        id: "entry-2",
        trigger: ["fae politics", "court intrigue"],
        content:
          "Fae politics operate on principles of bargains, oaths, and carefully worded agreements. Breaking one's word is not just dishonorable but can have magical consequences.",
        enabled: true,
      },
    ],
  },
];
