export const now = (): Date => new Date();

export const first = <T>(rows: T[]): T | null => rows[0] ?? null;

export const required = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
};
