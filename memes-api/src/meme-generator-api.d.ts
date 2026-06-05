declare module 'meme-generator-api' {
  export enum ActType {
    STORE = 0,
    APPEND = 1,
    COUNT = 2,
  }

  export type UserInfoGender = 'male' | 'female' | 'unknown'

  export interface UserInfo {
    name?: string
    gender?: UserInfoGender
  }

  export interface ParserArg {
    name: string
    value: string
  }

  export interface ParserOption {
    names: string[]
    args?: ParserArg[] | null
    dest?: string | null
    action?: {
      type: ActType
      value: any
    } | null
    help_text?: string | null
  }

  export interface MemeArgsResponse {
    args_model: Record<string, any>
    parser_options: ParserOption[]
  }

  export interface MemeParamsResponse {
    min_images: number
    max_images: number
    min_texts: number
    max_texts: number
    default_texts: string[]
    args_type?: MemeArgsResponse | null
  }

  export interface CommandShortcut {
    key: string
    args?: string[] | null
    humanized?: string | null
  }

  export interface MemeInfoResponse {
    key: string
    params_type: MemeParamsResponse
    keywords: string[]
    shortcuts: CommandShortcut[]
    tags: string[]
    date_created: string
    date_modified: string
  }

  export class MemeAPI {
    constructor(http: any)
    getKeys(): Promise<string[]>
    getInfo(key: string): Promise<MemeInfoResponse>
    renderList(data?: {
      meme_list?: Array<{
        meme_key: string
        disabled?: boolean
        labels?: Array<'new' | 'hot'>
      }>
      text_template?: string
      add_category_icon?: boolean
    }): Promise<Blob>
    renderPreview(key: string): Promise<Blob>
    renderMeme(
      key: string,
      options?: {
        images?: Blob[]
        texts?: string[]
        args?: Record<string, any> & {
          user_infos?: UserInfo[]
        }
      },
    ): Promise<Blob>
  }

  export class MemeError extends Error {
    readonly type:
      | 'no-such-meme'
      | 'text-over-length'
      | 'open-image-failed'
      | 'params-mismatch'
      | 'image-number-mismatch'
      | 'text-number-mismatch'
      | 'text-or-name-not-enough'
      | 'arg-mismatch'
      | 'arg-parser-mismatch'
      | 'arg-model-mismatch'
      | 'meme-feedback'
      | undefined
    readonly response: {
      status: number
    }
    get memeMessage(): string
  }
}
