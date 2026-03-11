import { Body, Controller, Inject, Post } from "@nestjs/common";
import { LoginProvider } from "@pixel-pet-arena/shared";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post("demo")
  signInDemo(
    @Body() body?: { displayName?: string; installId?: string },
  ) {
    return this.authService.signInDemo(body?.displayName, body?.installId);
  }

  @Post("social")
  signIn(
    @Body() body?: { displayName?: string; provider?: LoginProvider },
  ) {
    return this.authService.signIn(body?.displayName, body?.provider);
  }
}
