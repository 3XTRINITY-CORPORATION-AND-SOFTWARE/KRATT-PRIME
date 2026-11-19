import { loadWave8Config,createPostgresPoolFromConfig } from "../packages/kratt-orchestrator/src/wave8-live-connectors.mjs";
import { createPostgresRuntimeObservatoryStore } from "../packages/kratt-core/src/postgres-runtime-observatory-store.mjs";

let pool;
try{
 const config=loadWave8Config();
 pool=await createPostgresPoolFromConfig(config);
 const store=createPostgresRuntimeObservatoryStore(pool);
 const ready=await store.checkReady();
 if(!ready.ready)throw new Error("OBSERVATORY_SCHEMA_NOT_READY");
 const integrity=await store.verifyChain();
 process.stdout.write(JSON.stringify({
  status:integrity.ok?"VERIFIED":"DEGRADED",
  event_count:integrity.count??null,
  operation_count:integrity.operations??null,
  reason:integrity.ok?null:integrity.reason??"INTEGRITY_CHECK_FAILED",
 })+"\n");
 if(!integrity.ok)process.exitCode=2;
}catch(error){
 process.stderr.write(JSON.stringify({
  status:"FAILED",
  reason:String(error?.message??"OBSERVATORY_VERIFY_FAILED").split(":")[0],
 })+"\n");
 process.exitCode=1;
}finally{if(pool)try{await pool.end();}catch{}}
