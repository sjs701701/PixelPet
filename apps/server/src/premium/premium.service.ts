import { Inject, Injectable } from "@nestjs/common";
import { StoreService } from "../common/store.service";

@Injectable()
export class PremiumService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  verifyPurchase(userId: string, platformReceipt: string) {
    const user = this.store.getUser(userId);
    const updated = {
      ...user,
      premiumStatus: platformReceipt ? "premium" : "free",
    } as const;
    this.store.upsertUser(updated);
    return updated;
  }
}
