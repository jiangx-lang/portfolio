/**
 * 阿里云通义千问 OpenAI 兼容模式（DashScope）。
 * @see https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api
 */
import OpenAI from "openai";

export const QWEN_COMPAT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

/** 默认 qwen-plus；可通过环境变量 QWEN_MODEL 覆盖（如 qwen-turbo、qwen-max） */
export function getQwenModel(): string {
  const m = process.env.QWEN_MODEL?.trim();
  return m && m.length > 0 ? m : "qwen-plus";
}

export function createQwenOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: QWEN_COMPAT_BASE_URL,
  });
}
