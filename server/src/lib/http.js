/** HTTP helpers shared by all routes. */

/** An error the error handler (app.js) turns into a JSON response with this status. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Validate input (a request body or query string) with a zod schema.
 * Returns the cleaned data, or throws a 400 naming the first problem,
 * e.g. "title: Give the goal a title."
 */
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path?.length ? `${first.path.join('.')}: ` : '';
    throw new HttpError(400, `${where}${first?.message ?? 'Invalid request'}`, 'validation');
  }
  return result.data;
}
