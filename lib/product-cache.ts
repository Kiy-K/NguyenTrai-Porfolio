import { Redis } from '@upstash/redis';
import { createHash, randomUUID } from 'node:crypto';
import type { Product } from '@/data/products';

const TTL_MS = 60_000;
const EPOCH_TTL_SECONDS = 120;

export function productCacheKeys(): [string, string] {
  const url = new URL(process.env.APP_DATABASE_URL || process.env.DATABASE_URL || '');
  const identity = `${url.hostname.replace(/-pooler(?=\.)/, '')}/${decodeURIComponent(url.pathname.slice(1))}`;
  const scope = createHash('sha256').update(identity).digest('hex');
  const prefix = `portfolio:cache:v1:{${scope}}:public-products`;
  return [`${prefix}:epoch`, `${prefix}:data`];
}
function client() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN,
      retry: false, signal: () => AbortSignal.timeout(2000), enableAutoPipelining: false,
    });
  } catch {
    console.warn('Public product cache setup failed; reading the source.');
    return null;
  }
}
export function publicProducts(products: Product[]): Product[] {
  return products.filter(product => product && (product.status === undefined || product.status === 'published'));
}
// Even a read establishes an epoch on the Redis write path, shared across instances/replicas.
const READ = `-- cache:read
local epoch = redis.call('GET', KEYS[1])
if not epoch then epoch = ARGV[1] end
redis.call('SET', KEYS[1], epoch, 'EX', ARGV[3])
local now = redis.call('TIME')
return cjson.encode({token=epoch, payload=redis.call('GET', KEYS[2]) or false,
  deadline=tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000)+tonumber(ARGV[2])})`;
const PUBLISH = `-- cache:publish
local now = redis.call('TIME')
local remaining = tonumber(ARGV[3]) - (tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000))
if remaining <= 0 or redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('PSETEX', KEYS[2], remaining, ARGV[2])
return 1`;
const INVALIDATE = `-- cache:invalidate
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('DEL', KEYS[2])
return 1`;
type ReadContext = { token: string; payload: string | false; deadline: number };

export async function readPublicProducts(load: () => Promise<Product[]>): Promise<Product[]> {
  const redis = client();
  let context: ReadContext | null = null;
  let keys: [string, string] | null = null;
  if (redis) {
    try {
      keys = productCacheKeys();
      context = await redis.eval<unknown[], ReadContext>(READ, keys, [randomUUID(), TTL_MS, EPOCH_TTL_SECONDS]);
      if (context.payload) {
        const products: unknown = JSON.parse(context.payload);
        if (Array.isArray(products)) return publicProducts(products);
      }
    } catch {
      context = null;
      console.warn('Public product cache read failed; reading the source.');
    }
  }
  // Keep source failures outside cache error handling: a database outage must propagate.
  const products = publicProducts(await load());
  if (redis && context && keys) {
    try { await redis.eval(PUBLISH, keys, [context.token, JSON.stringify(products), context.deadline]); }
    catch { console.warn('Public product cache fill failed.'); }
  }
  return products;
}
export async function invalidateProductCache(): Promise<void> {
  const redis = client();
  if (!redis) return;
  try { await redis.eval(INVALIDATE, productCacheKeys(), [randomUUID(), EPOCH_TTL_SECONDS]); }
  catch { console.warn('Public product cache invalidation failed; the 60-second bound applies.'); }
}
