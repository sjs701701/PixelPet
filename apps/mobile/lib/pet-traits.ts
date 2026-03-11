import { PET_TRAITS, PetTraitId } from "@pixel-pet-arena/shared";
import { AppLanguage } from "./store";

type TraitCopy = {
  name: string;
  summary: string;
  battleEffect: string;
};

const TRAIT_COPY: Record<AppLanguage, Record<PetTraitId, TraitCopy>> = {
  ko: {
    assault: {
      name: "공격형",
      summary: "정면 화력으로 압박하는 전투 성향입니다.",
      battleEffect: "공격과 스킬 피해가 6% 증가합니다.",
    },
    guardian: {
      name: "수호형",
      summary: "방어 타이밍에 강점을 보이는 전투 성향입니다.",
      battleEffect: "가드 중 받는 피해가 추가로 감소합니다.",
    },
    quickstep: {
      name: "선봉형",
      summary: "속도 싸움에서 먼저 움직이기 쉬운 전투 성향입니다.",
      battleEffect: "선공 판정용 속도 보정이 +2 적용됩니다.",
    },
    sturdy: {
      name: "버팀형",
      summary: "위기에서 더 단단해지는 전투 성향입니다.",
      battleEffect: "체력이 50% 이하일 때 받는 피해가 6% 감소합니다.",
    },
    finisher: {
      name: "추격형",
      summary: "약해진 상대를 몰아붙이는 전투 성향입니다.",
      battleEffect: "상대 체력이 50% 이하일 때 피해가 8% 증가합니다.",
    },
    focus: {
      name: "집중형",
      summary: "정확한 스킬 타이밍에 강한 전투 성향입니다.",
      battleEffect: "스킬 피해가 8% 증가합니다.",
    },
  },
  en: {
    assault: {
      name: "Assault",
      summary: "Pushes through with direct offensive pressure.",
      battleEffect: "Attack and skill damage increase by 6%.",
    },
    guardian: {
      name: "Guardian",
      summary: "Excels when holding a defensive stance.",
      battleEffect: "Guard reduces incoming damage even further.",
    },
    quickstep: {
      name: "Quickstep",
      summary: "More likely to move first when speeds are close.",
      battleEffect: "Initiative speed bonus +2.",
    },
    sturdy: {
      name: "Sturdy",
      summary: "Gets tougher once battle turns dangerous.",
      battleEffect: "Incoming damage -6% below 50% HP.",
    },
    finisher: {
      name: "Finisher",
      summary: "Presses harder against weakened targets.",
      battleEffect: "Damage +8% against targets below 50% HP.",
    },
    focus: {
      name: "Focus",
      summary: "Leans into precise, stronger skill timing.",
      battleEffect: "Skill damage +8%.",
    },
  },
};

const UNKNOWN_COPY: Record<AppLanguage, TraitCopy> = {
  ko: {
    name: "미정",
    summary: "아직 재능 정보가 연결되지 않았습니다.",
    battleEffect: "전투 효과를 불러오지 못했습니다.",
  },
  en: {
    name: "Unknown",
    summary: "Trait info is not connected yet.",
    battleEffect: "Battle effect is unavailable.",
  },
};

export function getTraitCopy(language: AppLanguage, traitId?: PetTraitId): TraitCopy {
  if (!traitId) {
    return UNKNOWN_COPY[language];
  }

  return TRAIT_COPY[language][traitId] ?? {
    name: PET_TRAITS[traitId].name,
    summary: PET_TRAITS[traitId].summary,
    battleEffect: PET_TRAITS[traitId].battleEffect,
  };
}
