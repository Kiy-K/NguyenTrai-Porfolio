import { Redis } from '@upstash/redis';

// Kết nối với Upstash Redis sử dụng biến môi trường
// UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});
