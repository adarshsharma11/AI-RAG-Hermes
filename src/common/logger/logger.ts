import pino, { type LevelWithSilent, type Logger } from "pino";

import { APP_NAME } from "../../config/constants.js";

export interface CreateLoggerOptions {
  level: LevelWithSilent;
  environment: "development" | "test" | "production";
}

export type AppLogger = Logger;

export const createLogger = ({
  level,
  environment,
}: CreateLoggerOptions): Logger => {
  const transport =
    environment === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined;

  return pino({
    name: APP_NAME,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: APP_NAME,
      environment,
    },
    ...(transport ? { transport } : {}),
  });
};
