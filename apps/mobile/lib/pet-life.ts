import {
  CRITICAL_CORE_AVERAGE_THRESHOLD,
  CRITICAL_CORE_VALUE_THRESHOLD,
  PetInstance,
  PetLifeState,
  getCoreCareAverage,
  getTimeToDeathMs,
} from "@pixel-pet-arena/shared";
import { AppLanguage } from "./store";

type PetLifeCopy = {
  label: string;
  title: string;
  body: string;
};

const LIFE_COPY: Record<AppLanguage, Record<PetLifeState, PetLifeCopy>> = {
  ko: {
    good: {
      label: "GOOD",
      title: "좋은 상태",
      body: "컨디션 평균이 높아 성장 경험치를 받을 수 있습니다.",
    },
    alive: {
      label: "ALIVE",
      title: "안정 상태",
      body: "위험하진 않지만 경험치를 받으려면 컨디션을 더 끌어올려야 합니다.",
    },
    critical: {
      label: "CRITICAL",
      title: "위기 상태",
      body: "방치가 더 이어지면 사망합니다. 지금 바로 돌봐야 합니다.",
    },
    dead: {
      label: "DEAD",
      title: "사망 상태",
      body: "무료 부활권이 남아 있으면 복구할 수 있고, 아니면 새로 시작해야 합니다.",
    },
  },
  en: {
    good: {
      label: "GOOD",
      title: "Good Condition",
      body: "The average condition is high enough to earn growth XP.",
    },
    alive: {
      label: "ALIVE",
      title: "Stable",
      body: "The pet is safe, but the condition needs to improve before XP starts climbing.",
    },
    critical: {
      label: "CRITICAL",
      title: "Critical State",
      body: "If neglect continues, the pet will die. It needs care now.",
    },
    dead: {
      label: "DEAD",
      title: "Dead State",
      body: "Use a free revive if any remain, or restart with a new pet.",
    },
  },
};

export function getPetLifeCopy(language: AppLanguage, lifeState: PetLifeState) {
  return LIFE_COPY[language][lifeState];
}

export function getCriticalReason(language: AppLanguage, pet: Pick<PetInstance, "careState">) {
  const reasons: string[] = [];
  const { careState } = pet;

  if (careState.hunger <= CRITICAL_CORE_VALUE_THRESHOLD) {
    reasons.push(language === "ko" ? "배고픔이 위험 수치입니다." : "Hunger is in the danger zone.");
  }
  if (careState.mood <= CRITICAL_CORE_VALUE_THRESHOLD) {
    reasons.push(language === "ko" ? "기분이 바닥입니다." : "Mood has collapsed.");
  }
  if (careState.hygiene <= CRITICAL_CORE_VALUE_THRESHOLD) {
    reasons.push(language === "ko" ? "청결 수치가 심각합니다." : "Hygiene is critically low.");
  }
  if (careState.energy <= CRITICAL_CORE_VALUE_THRESHOLD) {
    reasons.push(language === "ko" ? "에너지가 고갈 직전입니다." : "Energy is almost depleted.");
  }
  if (getCoreCareAverage(careState) < CRITICAL_CORE_AVERAGE_THRESHOLD) {
    reasons.push(
      language === "ko"
        ? "핵심 컨디션 평균이 너무 낮습니다."
        : "The core condition average is too low.",
    );
  }

  if (reasons.length > 0) {
    return reasons.join(" ");
  }

  return language === "ko"
    ? "돌봄 지표가 위험 구간에 들어왔습니다."
    : "The pet has entered the danger zone.";
}

export function formatTimeToDeath(language: AppLanguage, pet: Pick<PetInstance, "lifeState" | "criticalSince">, now: Date) {
  const remaining = getTimeToDeathMs(pet, now);
  const totalMinutes = Math.max(0, Math.ceil(remaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (language === "ko") {
    return `${hours}시간 ${minutes}분 남음`;
  }

  return `${hours}h ${minutes}m left`;
}
