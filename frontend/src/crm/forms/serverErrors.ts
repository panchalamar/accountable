import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError, errorMessage } from "../../api/client";

/**
 * Puts the server's field errors on the matching fields and focuses the first
 * of them, in the form's order. Returns a message for anything that isn't a
 * field, such as a refused move, to show at the top of the form.
 */
export function placeServerErrors<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  order: Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return errorMessage(error);
  const leftOver: string[] = [];
  let first: Path<T> | null = null;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (order.includes(field as Path<T>)) {
      form.setError(field as Path<T>, { type: "server", message });
    } else {
      leftOver.push(message);
    }
  }
  for (const field of order) {
    if (error.fieldErrors[field as string]) {
      first = field;
      break;
    }
  }
  if (first) form.setFocus(first);
  if (error.status === 422 && leftOver.length === 0) return null;
  return leftOver.length ? leftOver.join(" ") : error.message;
}
