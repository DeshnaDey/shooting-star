from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings. Reads from environment / .env file.

    DATABASE_URL:
      - Supabase: postgresql+psycopg://postgres.<ref>:<password>@<host>:5432/postgres
        (Supabase dashboard -> Connect -> use the *Session pooler* URI; replace
        `postgresql://` with `postgresql+psycopg://`)
      - Default: local SQLite file, zero setup.

    LLM:
      - LLM_PROVIDER=ollama with local Ollama (`ollama serve`, default base URL)
        or Ollama Cloud (base URL https://ollama.com, api key from ollama.com).
      - LLM_PROVIDER=mock for a deterministic offline provider (no network).
      - If ollama is selected but unreachable, the app silently falls back to
        mock so the demo keeps working (responses are flagged provider=mock).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./shooting_star.db"

    llm_provider: str = "ollama"          # "ollama" | "mock"
    ollama_base_url: str = "http://localhost:11434"
    ollama_api_key: str = ""              # required for Ollama Cloud only
    ollama_model: str = "qwen3:8b"
    llm_timeout_s: float = 120.0

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    jwt_secret: str = "dev-secret-change-me"
    jwt_expiry_days: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
