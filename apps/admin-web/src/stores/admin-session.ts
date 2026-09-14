"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser } from "@listenup/domain";
import { ADMIN_SESSION_STORAGE_KEY } from "@listenup/auth";
interface State { token:string|null;user:AdminUser|null;setSession:(token:string,user:AdminUser)=>void;clear:()=>void; }
export const useAdminSession = create<State>()(persist((set)=>({token:null,user:null,setSession:(token,user)=>set({token,user}),clear:()=>set({token:null,user:null})}),{name:ADMIN_SESSION_STORAGE_KEY}));
