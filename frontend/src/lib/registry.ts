export const LLM_PROVIDERS = ['deepseek', 'doubao'] as const;
export const IMAGE_PROVIDERS = ['gpt-image-2', 'seedream'] as const;

export type LLMProvider = (typeof LLM_PROVIDERS)[number];
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export const DEFAULT_DOUBAO_MODEL = 'doubao-1-5-pro-32k-250115';
export const DEFAULT_SEEDREAM_T2I_MODEL = 'doubao-seedream-3-0-t2i-250415';
export const DEFAULT_SEEDREAM_I2I_MODEL = 'doubao-seededit-3-0-i2i-250628';

export const ENDPOINTS = {
  deepseek: 'https://api.deepseek.com/v1',
  volcanoArk: 'https://ark.cn-beijing.volces.com/api/v3',
  apimart: 'https://api.apimart.ai',
} as const;
