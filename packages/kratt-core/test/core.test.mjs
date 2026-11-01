import test from "node:test";
import assert from "node:assert/strict";
import { KRATT_SCHEMA_VERSION, validateTaskEnvelope } from "../src/contracts.mjs";
import { evaluatePolicy } from "../src/policy.mjs";
import { MemoryLedger } from "../src/memory-ledger.mjs";
import { createSaga, transitionSaga } from "../src/saga.mjs";
import { AgentRegistry } from "../src/agent-registry.mjs";

const at = "2026-11-01T00:00:00Z";
const task = () => ({schema_version:KRATT_SCHEMA_VERSION,task_id:"task-1",actor:"builder",action:"repo.read",target:{resource_type:"repository",resource_id:"KRATT-PRIME"},constraints:{branch:"integration"},required_evidence:[],created_at:at,requested_authority:["admin"],status:"PENDING"});
const context = () => ({schema_version:KRATT_SCHEMA_VERSION,authorities:["repository.read"],allowed_targets:[{resource_type:"repository",resource_id:"KRATT-PRIME"}],policies:[{action:"repo.read",required_authority:"repository.read",target_types:["repository"]}],evaluated_at:at});

test("task contract rejects unrecognized privilege fields",()=>{assert.equal(validateTaskEnvelope(task()).ok,true);assert.equal(validateTaskEnvelope({...task(),admin:true}).ok,false);});
test("policy uses trusted context, never task requested authority",()=>{assert.equal(evaluatePolicy(task(),[],context()).decision,"ALLOW");assert.equal(evaluatePolicy(task(),[],{...context(),authorities:[]}).decision,"DENY");assert.equal(evaluatePolicy({...task(),target:{resource_type:"repository",resource_id:"OTHER"}},[],context()).decision,"DENY");});
test("invalid trusted context blocks",()=>{assert.equal(evaluatePolicy(task(),[],null).decision,"BLOCKED");});
test("memory ledger rejects duplicate IDs and verifies entries",()=>{const m=new MemoryLedger();assert.equal(m.append({id:"m1",kind:"finding",createdAt:at,payload:{sha:"abc"}}).ok,true);assert.equal(m.append({id:"m1",kind:"finding",createdAt:at,payload:{sha:"x"}}).reason,"DUPLICATE_MEMORY_ID");assert.equal(m.verify().ok,true);});
test("Saga state machine rejects invalid transitions",()=>{let s=createSaga({id:"s1",goal:"audit",createdAt:at});s=transitionSaga(s,"RUNNING",{id:"e1",at,kind:"start"}).value;assert.equal(transitionSaga(s,"PENDING",{id:"e2",at,kind:"rewind"}).reason,"INVALID_STATE_TRANSITION");});
test("agent registry prevents privilege escalation",()=>{const a=new AgentRegistry();assert.equal(a.registerAgent({id:"builder",scopes:["repository.read"],status:"active"}).ok,true);assert.equal(a.registerAgent({id:"root",scopes:["production.deploy"],status:"active"}).reason,"INVALID_AGENT");a.registerTool({name:"read",requiredScopes:["repository.read"]});assert.equal(a.authorize("builder","read","repository.read").allowed,true);assert.equal(a.authorize("builder","read","production.deploy").allowed,false);});
