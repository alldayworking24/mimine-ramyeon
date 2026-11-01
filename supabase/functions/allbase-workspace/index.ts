import {workspaceProjects} from './allbase-workspace-server.mjs';
import {handleWorkspaceRequest} from './supabase-allbase-workspace.mjs';
const env = (name:string) => Deno.env.get(name);
const app = Object.entries(workspaceProjects).find(([,project])=>project.url===env('SUPABASE_URL'))?.[0];
// Platform JWT checks do not understand our scoped Ed25519 proof. The handler
// verifies signature, issuer, audience and expiry before any privileged Auth call.
Deno.serve((request:Request)=>handleWorkspaceRequest(request,{app,env}));
