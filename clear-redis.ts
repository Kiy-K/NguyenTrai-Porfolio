import { redis } from './lib/redis';

async function clearData() {
  try {
    console.log("URL:", process.env.UPSTASH_REDIS_REST_URL ? "Set" : "Not Set");
    await redis.set('portfolio_data_v4', { products: [] });
    console.log("Successfully cleared portfolio_data_v4 and set to empty array.");
  } catch (e) {
    console.error("Failed to clear data:", e);
  }
}

clearData();
