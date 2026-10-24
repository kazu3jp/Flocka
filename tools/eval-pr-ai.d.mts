export const DEFAULT_MODELS: string[];
export const FIXTURES: { name: string; card: string; texts: string[] }[];
export function parseArgs(argv: string[]): {
  dryRun: boolean;
  models: string[];
};
export function requestFor(fixture: { card: string; texts: string[] }): {
  messages: { role: string; content: string }[];
  max_completion_tokens: number;
  temperature: number;
};
export function main(
  argv: string[],
  env: Record<string, string | undefined>,
): Promise<number>;
