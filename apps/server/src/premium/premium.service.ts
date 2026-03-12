import { Inject, Injectable, NotImplementedException } from "@nestjs/common";
import { StoreService } from "../common/store.service";

@Injectable()
export class PremiumService {
  private readonly devModeEnabled = true;

  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  getStatus(userId: string) {
    const user = this.store.getUser(userId);
    return {
      premiumStatus: user.premiumStatus,
      premiumSource: user.premiumStatus === "premium" ? "dev-toggle" : "none",
      devModeEnabled: this.devModeEnabled,
      realVerificationAvailable: false,
    } as const;
  }

  verifyPurchase(_userId: string, _platformReceipt?: string) {
    throw new NotImplementedException(
      "Real purchase verification is not available in this prototype. Use the dev premium toggle only for internal testing.",
    );
  }

  toggleDevPremium(userId: string, enabled: boolean) {
    const user = this.store.getUser(userId);
    const updated = {
      ...user,
      premiumStatus: enabled ? "premium" : "free",
    } as const;
    this.store.upsertUser(updated);
    return {
      user: updated,
      premiumSource: enabled ? "dev-toggle" : "none",
      devModeEnabled: this.devModeEnabled,
      realVerificationAvailable: false,
    } as const;
  }
}
