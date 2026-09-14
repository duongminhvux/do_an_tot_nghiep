import { clsx,type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...values:ClassValue[]) => twMerge(clsx(values));
export const delay = (ms=320) => new Promise((resolve)=>setTimeout(resolve,ms));
