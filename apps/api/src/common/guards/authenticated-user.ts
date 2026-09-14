import type { AuthClientType, UserRole } from "../../generated/prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clientType: AuthClientType;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  clientType: AuthClientType;
  type: "access";
}
