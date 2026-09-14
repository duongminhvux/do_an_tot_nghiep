import { http,HttpResponse } from "msw";
import { adminEndpoints } from "@listenup/api-client";
import { adminMockApi } from "@/lib/api/mock-service";
export const handlers=[http.post(adminEndpoints.login,async({request})=>{const body=await request.json() as {email:string;password:string};try{return HttpResponse.json({data:await adminMockApi.login(body.email,body.password)})}catch(error){return HttpResponse.json({error:{code:"UNAUTHENTICATED",message:error instanceof Error?error.message:"Login failed",requestId:"mock-login-request"}},{status:401})}})];
