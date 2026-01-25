import { getRequestContext } from '@cloudflare/next-on-pages';

export function getDB() {
  return getRequestContext().env.DB;
}
