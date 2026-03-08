import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AuthSessionService } from "./session.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthSessionService)
    private readonly sessions: AuthSessionService,
  ) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const bearer = request.headers.authorization?.replace(/^Bearer /, "");
    request.userId = this.sessions.verifyToken(bearer);
    return true;
  }
}
