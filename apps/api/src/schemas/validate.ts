import type { z } from "zod";
import { AppError } from "../errors.js";

/** Parses input with a Zod schema, or throws a 400 listing each invalid field. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The request is invalid.",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}
