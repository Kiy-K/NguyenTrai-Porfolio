// Run only against synthetic isolated staging, with the three app processes already started.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {randomUUID,createHmac}=require('node:crypto');
async function main() {
assert.equal(process.env.TEST_ISOLATED_STAGING, '1');
assert.equal(process.env.TEST_REDIS_DISPOSABLE, '1');
const url=process.env.STAGING_DATABASE_URL;
const target=new URL(url);
assert.equal(target.hostname,process.env.STAGING_EXPECTED_NEON_HOST);
assert.notEqual(target.hostname.replace('-pooler.','.'),'ep-noisy-surf-b3cj9447.c-4.ap-southeast-1.aws.neon.tech');
const origins={a:process.env.STAGING_APP_URL_A,b:process.env.STAGING_APP_URL_B,outage:process.env.STAGING_NEON_OUTAGE_APP_URL};
for(const origin of Object.values(origins)) {
  const parsed=new URL(origin);
  assert.ok(parsed.protocol === 'https:' || parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.origin,origin);
  assert.notEqual(parsed.hostname,'nguyen-trai-porfolio.vercel.app');
}
assert.ok(process.env.STAGING_AUTH_PEPPER);
assert.ok(process.env.TEST_REDIS_REST_URL);assert.ok(process.env.TEST_REDIS_REST_TOKEN);
process.env.DATABASE_URL=url;delete process.env.APP_DATABASE_URL;process.env.PERSISTENCE_BACKEND='postgres';
process.env.UPSTASH_REDIS_REST_URL=process.env.TEST_REDIS_REST_URL;process.env.UPSTASH_REDIS_REST_TOKEN=process.env.TEST_REDIS_REST_TOKEN;
const {Redis}=require('@upstash/redis');const redis=new Redis({url:process.env.TEST_REDIS_REST_URL,token:process.env.TEST_REDIS_REST_TOKEN,enableAutoPipelining:false});
const loadTs=require('./load-ts.cjs');const cache=loadTs('lib/product-cache.ts');
const store=loadTs('lib/persistence.ts',{'@/lib/redis':{redis},'@/lib/product-cache':cache});
const api=async(instance,path='/api/products',options={})=>{const started=performance.now();const response=await fetch(`${origins[instance]}${path}`,{...options,signal:AbortSignal.timeout(20000)});const body=await response.json();return {response,body,ms:Math.round(performance.now()-started)};};
await (async()=>{
 const baseline=await store.readContent();assert.equal(baseline.products.length,4);
 assert.deepEqual(baseline.products.map(p=>p.id).sort(),['cache-stage-public','cache-stage-legacy','cache-stage-draft','cache-stage-archive'].sort());
 let report;
 try {
 const sid=randomUUID(),ip='203.0.113.50',pepper=process.env.STAGING_AUTH_PEPPER;
 await redis.hset(`admin:session:${sid}`,{sessionId:sid,ipHash:createHmac('sha256',pepper).update(ip).digest('hex'),expiresAtUnix:String(Date.now()+3600000),createdAtUnix:String(Date.now())});await redis.expire(`admin:session:${sid}`,3600);
 const headers={'cookie':`admin_session=${sid}`,'x-forwarded-for':ip,'content-type':'application/json'};
 await cache.invalidateProductCache();
 const miss=await api('a'),hit=await api('b');assert.equal(miss.response.status,200);assert.equal(hit.response.status,200);assert.equal(hit.response.headers.get('cache-control'),'no-store');
 assert.deepEqual(hit.body,miss.body);assert.deepEqual(hit.body.products.map(p=>p.id),['cache-stage-public','cache-stage-legacy']);
 const warmWithoutDb=await api('outage');assert.equal(warmWithoutDb.response.status,200);assert.deepEqual(warmWithoutDb.body,hit.body);
 const keys=cache.productCacheKeys(),ttl=await redis.pttl(keys[1]);assert.ok(ttl>0&&ttl<=60000);
 const cached=await redis.get(keys[1]);assert.deepEqual(cached,hit.body.products);assert.ok(!JSON.stringify(cached).includes('synthetic-name-hash'));assert.ok(!JSON.stringify(cached).includes('Private synthetic'));
 assert.deepEqual(cached[0].videos,baseline.products[0].videos);assert.equal(cached[0].video,baseline.products[0].video);
 const anonymous=await api('a','/api/products?fresh=1');assert.equal(anonymous.response.status,401);
 const fresh=await api('b','/api/products?fresh=1',{headers});assert.equal(fresh.response.status,200);assert.equal(fresh.body.products.length,4);assert.equal(fresh.response.headers.get('cache-control'),'no-store');
 const draft=await api('a','/api/products/cache-stage-draft');assert.equal(draft.response.status,404);assert.equal(draft.response.headers.get('cache-control'),'no-store');
 const epoch=await redis.get(keys[0]);
 const created=await api('a','/api/products',{method:'POST',headers:{...headers,Origin:origins.a},body:JSON.stringify({title:'Synthetic HTTP mutation',description:'Dedicated staging only',images:[],section:'Tranh vẽ'})});assert.equal(created.response.status,201);assert.notEqual(await redis.get(keys[0]),epoch);
 const after=await api('b');assert.ok(after.body.products.some(p=>p.id===created.body.product.id));
 const {CLEAR_ALL_CONFIRMATION}=loadTs('lib/constants.ts');
 const cleared=await api('a','/api/products',{method:'DELETE',headers:{...headers,Origin:origins.a},body:JSON.stringify({confirm:CLEAR_ALL_CONFIRMATION})});assert.equal(cleared.response.status,200);assert.equal(cleared.body.deleted.length,5);assert.equal(cleared.response.headers.get('cache-control'),'no-store');assert.equal((await api('b')).body.products.length,0);
 await store.writeContent(baseline);
 // Corrupt only the synthetic cache key's type; real app must read the staging DB directly.
 await redis.hset(keys[1],{synthetic:'wrong-type'});
 const fallback=await api('b');assert.equal(fallback.response.status,200);assert.equal(fallback.body.products.length,2);
 await cache.invalidateProductCache();
 const dbOutage=await api('outage');assert.equal(dbOutage.response.status,500);assert.equal(dbOutage.body.products,undefined);assert.equal(dbOutage.response.headers.get('cache-control'),'no-store');
 const publicPage=await fetch(`${origins.a}/products/cache-stage-public`);assert.equal(publicPage.status,200);assert.match(publicPage.headers.get('cache-control'),/no-store/);
 const section=await fetch(`${origins.b}/sections/tranh-ve`);assert.equal(section.status,200);assert.match(section.headers.get('cache-control'),/no-store/);
 report={staging:true,nodeVersion:process.version,neonTargetFingerprint:require('../scripts/migrate-neon.cjs').destinationFingerprint(url),productionBuild:true,appInstances:2,source:'dedicated staging Neon',redis:'dedicated scratch Upstash',missMs:miss.ms,hitMs:hit.ms,cacheTtlMs:ttl,publicIdsAndMediaVerified:true,adminFreshAndAuthVerified:true,postDeleteCrossInstanceInvalidationVerified:true,redisFailureDirectNeonVerified:true,neonUnavailableWarmHitStatus:warmWithoutDb.response.status,neonOutageStatus:dbOutage.response.status,pageCacheControl:publicPage.headers.get('cache-control'),sectionCacheControl:section.headers.get('cache-control'),cdn:'local production server; Vercel CDN not exercised',baselineRestored:true};
 } finally { await store.writeContent(baseline); }
 if(process.env.STAGING_RECEIPT_PATH)fs.writeFileSync(process.env.STAGING_RECEIPT_PATH,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})();
}
main().catch(error=>{console.error(`Staging HTTP check failed (${error.name}); details suppressed to protect configuration.`);process.exitCode=1;});
