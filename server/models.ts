import { gateway, type LanguageModel } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Gateway uses the project's short-lived Vercel OIDC identity when no key is supplied. */
export function gatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim() || process.env.VERCEL === "1");
}

export function textModelConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) || gatewayConfigured();
}
export function scanModelConfigured() { return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) || gatewayConfigured(); }

export function textModel(options: { fast?: boolean } = {}): LanguageModel {
  // A deliberately supplied provider key retains the existing local deployment behavior.
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    const provider = createDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    });
    const configured = options.fast
      ? process.env.DEEPSEEK_FAST_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat"
      : process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
    return provider(options.fast && /reasoner/i.test(configured) ? "deepseek-chat" : configured);
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return createGoogleGenerativeAI({apiKey:process.env.GOOGLE_GENERATIVE_AI_API_KEY})(process.env.POLICY_LENS_GOOGLE_TEXT_MODEL || 'gemini-2.5-flash');
  return gateway(process.env.POLICY_LENS_TEXT_MODEL?.trim() || "deepseek/deepseek-v3.1");
}

export function scanModel(): LanguageModel {
  // Vision is separate from the text-only DeepSeek provider configuration.
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return createGoogleGenerativeAI({apiKey:process.env.GOOGLE_GENERATIVE_AI_API_KEY})(process.env.POLICY_LENS_GOOGLE_OCR_MODEL || 'gemini-2.5-flash');
  return gateway(process.env.POLICY_LENS_OCR_MODEL?.trim() || "google/gemini-2.5-flash");
}
