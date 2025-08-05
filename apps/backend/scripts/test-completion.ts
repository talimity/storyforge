#!/usr/bin/env node

import type { CompletionInput } from "@storyforge/api";
import { readFileSync } from "fs";
import { resolve } from "path";

// Simple command line argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const config: {
    prompt?: string;
    provider?: string;
    model?: string;
    stream?: boolean;
    sse?: boolean;
    temperature?: number;
    maxTokens?: number;
    role?: "system" | "reference" | "history" | "task";
    help?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--prompt":
      case "-p":
        config.prompt = nextArg;
        i++;
        break;
      case "--provider":
        config.provider = nextArg;
        i++;
        break;
      case "--model":
      case "-m":
        config.model = nextArg;
        i++;
        break;
      case "--stream":
      case "-s":
        config.stream = true;
        break;
      case "--sse":
        config.sse = true;
        break;
      case "--temperature":
      case "-t":
        if (nextArg) {
          config.temperature = parseFloat(nextArg);
          i++;
        }
        break;
      case "--max-tokens":
        if (nextArg) {
          config.maxTokens = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--role":
      case "-r":
        if (
          nextArg &&
          ["system", "reference", "history", "task"].includes(nextArg)
        ) {
          config.role = nextArg as "system" | "reference" | "history" | "task";
          i++;
        }
        break;
      case "--help":
      case "-h":
        config.help = true;
        break;
    }
  }

  return config;
}

function showHelp() {
  console.log(`
Test Completion Utility

Usage: pnpm test:completion [options]

Options:
  -p, --prompt <text>        Prompt text to send (required)
  --provider <name>          Provider to use (default: mock)
  -m, --model <name>         Model to use (default: mock-default)
  -s, --stream               Use tRPC streaming completion (WebSocket)
  --sse                      Use SSE streaming completion (HTTP)
  -t, --temperature <num>    Temperature (0.0-2.0, default: 0.7)
  --max-tokens <num>         Max tokens (default: 150)
  -r, --role <role>          Role for the prompt section (system|reference|history|task, default: task)
  -h, --help                 Show this help

Examples:
  pnpm test:completion -p "Write a short story about a dragon"
  pnpm test:completion -p "Hello" --provider openrouter -m "meta-llama/llama-3.2-3b-instruct:free" -s
  pnpm test:completion -p "Hello" --sse
  pnpm test:completion -p "You are a helpful assistant" -r system --temperature 0.5 --max-tokens 100
`);
}

async function testCompletion() {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    return;
  }

  if (!config.prompt) {
    console.error("Error: --prompt is required");
    showHelp();
    process.exit(1);
  }

  // Default values
  const provider = config.provider || "mock";
  const model = config.model || "mock-default";
  const stream = config.stream || false;
  const sse = config.sse || false;
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens || 150;
  const role = config.role || "task";

  // Build the completion input
  const input: CompletionInput = {
    provider,
    model,
    parameters: {
      temperature,
      maxTokens,
    },
    sections: [
      {
        id: "user-prompt",
        content: config.prompt,
        metadata: { role },
      },
    ],
  };

  console.log(
    `Testing ${sse ? "SSE streaming" : stream ? "tRPC streaming" : "non-streaming"} completion:`
  );
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${model}`);
  console.log(`Temperature: ${temperature}`);
  console.log(`Max Tokens: ${maxTokens}`);
  console.log(`Role: ${role}`);
  console.log(`Prompt: "${config.prompt}"`);
  console.log("---");

  try {
    if (sse) {
      await testSSECompletion(input);
    } else if (stream) {
      await testStreamingCompletion(input);
    } else {
      await testNonStreamingCompletion(input);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

async function testNonStreamingCompletion(input: CompletionInput) {
  const url = "http://localhost:3001/trpc/debug.completion";
  const body = JSON.stringify({ input });

  console.log("Making request to:", url);
  console.log("Request body:", body);
  console.log();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  console.log("Response:");
  console.log("Text:", result.result.data.text);
  console.log("Provider:", result.result.data.provider);
  if (result.result.data.metadata) {
    console.log(
      "Metadata:",
      JSON.stringify(result.result.data.metadata, null, 2)
    );
  }
  console.log();
  console.log("Rendered Prompt:");
  console.log(result.result.data.prompt);
}

async function testStreamingCompletion(input: CompletionInput) {
  // For streaming, we need to use WebSocket or Server-Sent Events
  // Since tRPC subscriptions typically use WebSocket, we'll simulate this
  console.log("Note: Streaming completion requires WebSocket support.");
  console.log(
    "For now, testing with regular completion and simulating streaming behavior."
  );

  // Fall back to regular completion for now
  await testNonStreamingCompletion(input);

  console.log();
  console.log("To test actual streaming, you would need to:");
  console.log("1. Set up a WebSocket client");
  console.log("2. Connect to the tRPC subscription endpoint");
  console.log("3. Subscribe to debug.completionStream");
}

async function testSSECompletion(input: CompletionInput) {
  const url = "http://localhost:3001/api/debug/completion/stream";
  const body = JSON.stringify(input);

  console.log("Making SSE request to:", url);
  console.log("Request body:", body);
  console.log();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("No response body received");
  }

  console.log("SSE Stream Response:");
  console.log("---");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

      for (const line of lines) {
        if (line.trim() === "") continue;

        if (line.startsWith("event: ")) {
          const event = line.slice(7);
          console.log(`[Event: ${event}]`);
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            console.log("Data:", JSON.stringify(parsed, null, 2));
          } catch {
            console.log("Data (raw):", data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log("---");
  console.log("SSE stream completed");
}

// Run the script
testCompletion().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
