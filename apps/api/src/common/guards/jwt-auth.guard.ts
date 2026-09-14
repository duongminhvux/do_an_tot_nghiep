import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AccessTokenClaims, AuthenticatedUser } from "./authenticated-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("An access token is required.");

    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        audience: "listenup-api",
        issuer: "listenup",
      });
      if (claims.type !== "access") throw new Error("Unexpected token type");
      const account = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { email: true, role: true, status: true },
      });
      if (
        !account ||
        account.status !== UserStatus.ACTIVE ||
        account.email !== claims.email ||
        account.role !== claims.role
      ) {
        throw new Error("Account is no longer eligible for this session");
      }
      request.user = {
        id: claims.sub,
        email: claims.email,
        role: claims.role,
        clientType: claims.clientType,
      };
      return true;
    } catch {
      throw new UnauthorizedException("The access token is invalid or expired.");
    }
  }
}
