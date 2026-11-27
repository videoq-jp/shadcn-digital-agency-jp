import { ScreenValidationError } from "../scripts/a2ui/protocol"

export type GenerationErrorCode =
  | "output_token_limit"
  | "incomplete_stream"
  | "output_size_limit"
  | "model_refusal"
  | "provider_error"

export class ModelGenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ModelGenerationError"
  }
}

/** Public errors describe the failure without exposing prompts, model output or provider internals. */
export function publicGenerationError(error: unknown, timedOut: boolean) {
  if (timedOut)
    return {
      code: "generation_timeout",
      error:
        "生成の待ち時間（180秒）を超えました。もう一度試すか、画面を分けて依頼してください。",
    }
  if (error instanceof ModelGenerationError)
    return { code: error.code, error: error.message }
  if (error instanceof ScreenValidationError)
    return {
      code: "invalid_screen",
      error:
        "生成された画面データが部品の仕様に合わず、修正後も検証に通りませんでした。依頼の内容を変えて再試行してください。",
    }
  return {
    code: "provider_error",
    error:
      "AIサービスへの接続または生成処理に失敗しました。少し待って再試行してください。",
  }
}
