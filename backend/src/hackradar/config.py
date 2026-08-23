from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str = "sqlite:///./hackradar.db"
    brightdata_api_key: str | None = None
    openai_api_key: str | None = None
    operator_token: str | None = None
    auto_heal_enabled: bool = True
    collector_cli_timeout_seconds: int = 900
    allowed_origins: str = "https://abhijitmohanty.com,http://localhost:3000"

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(",") if value.strip()]
