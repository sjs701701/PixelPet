import { Platform } from "react-native";

type ApiLanguage = "ko" | "en";
type ApiTargetSource = "env" | "android-emulator" | "localhost";

const DEFAULT_ANDROID_API_URL = "http://10.0.2.2:3001";
const DEFAULT_LOCALHOST_API_URL = "http://localhost:3001";

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function readEnvApiUrl() {
  const processRef = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  const value = processRef?.env?.EXPO_PUBLIC_API_URL;
  if (!value) {
    return undefined;
  }

  const normalized = normalizeApiUrl(value);
  return normalized.length > 0 ? normalized : undefined;
}

function resolveApiTarget(): { url: string; source: ApiTargetSource } {
  const envUrl = readEnvApiUrl();
  if (envUrl) {
    return { url: envUrl, source: "env" };
  }

  if (Platform.OS === "android") {
    return { url: DEFAULT_ANDROID_API_URL, source: "android-emulator" };
  }

  return { url: DEFAULT_LOCALHOST_API_URL, source: "localhost" };
}

const API_TARGET = resolveApiTarget();
const API_URL = API_TARGET.url;

export class ApiError extends Error {
  status: number;
  code: "http" | "network";
  apiUrl: string;

  constructor(message: string, status: number, code: "http" | "network" = "http") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.apiUrl = API_URL;
  }
}

function getSourceLabel(language: ApiLanguage) {
  if (API_TARGET.source === "env") {
    return language === "ko" ? "환경 변수(EXPO_PUBLIC_API_URL)" : "environment override (EXPO_PUBLIC_API_URL)";
  }

  if (API_TARGET.source === "android-emulator") {
    return language === "ko" ? "안드로이드 에뮬레이터 기본값" : "Android emulator default";
  }

  return language === "ko" ? "로컬호스트 기본값" : "localhost default";
}

export function getApiBaseUrl() {
  return API_URL;
}

export function getApiEndpointSummary(language: ApiLanguage) {
  const prefix = language === "ko" ? "현재 서버" : "Current server";
  return `${prefix}: ${API_URL} (${getSourceLabel(language)})`;
}

export function getApiOverrideHelp(language: ApiLanguage) {
  if (language === "ko") {
    return "실기기나 다른 PC 주소를 쓰려면 apps/mobile/.env.local 에 EXPO_PUBLIC_API_URL=http://내IP:3001 을 넣고 Expo를 다시 시작하세요.";
  }

  return "For a real device or another host, add EXPO_PUBLIC_API_URL=http://YOUR_IP:3001 to apps/mobile/.env.local and restart Expo.";
}

export function getFriendlyApiErrorMessage(error: unknown, language: ApiLanguage) {
  const endpointSummary = getApiEndpointSummary(language);
  const overrideHelp = getApiOverrideHelp(language);

  if (error instanceof ApiError) {
    if (error.code === "network") {
      if (language === "ko") {
        return `서버에 연결하지 못했습니다.\n${endpointSummary}\n${overrideHelp}`;
      }

      return `Could not reach the API server.\n${endpointSummary}\n${overrideHelp}`;
    }

    if (error.status >= 500) {
      if (language === "ko") {
        return `서버가 요청을 처리하지 못했습니다.\n${endpointSummary}`;
      }

      return `The server failed while handling the request.\n${endpointSummary}`;
    }

    if (error.status === 404) {
      if (language === "ko") {
        return `API 경로를 찾지 못했습니다.\n${endpointSummary}`;
      }

      return `The API route was not found.\n${endpointSummary}`;
    }
  }

  if (language === "ko") {
    return `서버 요청을 완료하지 못했습니다.\n${endpointSummary}`;
  }

  return `The request could not be completed.\n${endpointSummary}`;
}

export async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(`Network request failed for ${path}`, 0, "network");
  }

  if (!response.ok) {
    throw new ApiError(`Request failed for ${path}`, response.status, "http");
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
