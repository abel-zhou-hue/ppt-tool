from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    apimart_api_key: str = ""
    apimart_base_url: str = "https://api.apimart.ai"

    # 火山方舟 Volcano Engine Ark (Doubao + Seedream 共用同一个 API key)
    volcano_ark_api_key: str = ""
    volcano_ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = "doubao-1-5-pro-32k-250115"
    seedream_t2i_model: str = "doubao-seedream-3-0-t2i-250415"
    seedream_i2i_model: str = "doubao-seededit-3-0-i2i-250628"

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    qwen_api_key: str = ""


settings = Settings()
