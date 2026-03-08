import { Controller, Get, Inject } from "@nestjs/common";
import { StoreService } from "../common/store.service";

@Controller("content")
export class ContentController {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  @Get("characters")
  listCharacters() {
    return this.store.listTemplates();
  }
}
