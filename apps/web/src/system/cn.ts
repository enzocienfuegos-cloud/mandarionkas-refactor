/**
 * Class-name composer.
 *
 * Joins truthy class strings together. Filters out falsy values
 * (false, null, undefined, '') so conditional class composition stays clean.
 *
 * @example
 *   cn('px-4', isActive && 'bg-brand-500', error ? 'text-red-500' : null)
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
