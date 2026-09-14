import { UserRole, UserStatus } from "./enums";
import type { User } from "./entities";

export const canAccessStudentApp = (user?: User | null) => Boolean(user && user.status === UserStatus.ACTIVE && user.role === UserRole.STUDENT);
