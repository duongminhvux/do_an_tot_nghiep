import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
export const adminWorker=setupWorker(...handlers);
