import { config } from "@storyforge/config";
import pino from "pino";

export const logger = pino(
  config.logging.pretty
    ? {
        level: config.logging.level,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        level: config.logging.level,
      }
);

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}
