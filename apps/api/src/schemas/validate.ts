import type { z } from "zod";
import { AppError } from "../errors.js";

/**
 * Parses input with a Zod schema, or throws a 400 listing each invalid field.
 * The top-level message is the first problem, so a client can show it as is.
 */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues;
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      issues[0]?.message ?? "The request is invalid.",
      issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}
