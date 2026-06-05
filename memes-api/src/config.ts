import { HTTP, Schema } from 'koishi'

import zhCNLocale from './locales/zh-CN'

export interface GenerateCommandConfig {
  enableShortcut: boolean
  shortcutUsePrefix?: boolean
  silentShortcut?: boolean
  moreSilent?: boolean
  autoUseDefaultTexts: boolean
  autoUseSenderAvatarWhenOnlyOne: boolean
  autoUseSenderAvatarWhenOneLeft: boolean
  enableProtectedTargetSwap: boolean
  protectedTargetUserId: string
}

export interface ImageProtectionConfig {
  enableProtectedImageSwap: boolean
  protectedImageMd5List: string[]
}

export enum ListSortBy {
  Default = 'default',
  Type = 'type',
  Key = 'key',
  Keywords = 'keywords',
  DateCreated = 'dateCreated',
  DateModified = 'dateModified',
}

export interface ListConfig {
  listSortBy: ListSortBy
  listSortReverse: boolean
  listNewTimeDelta: number
  listTextTemplate: string
  listAddCategoryIcon: boolean
}

export interface OtherCommandConfig {
  randomMemeShowInfo: boolean
  generateSubCommandCountToFather: boolean
  randomCommandCountToGenerate: boolean
}

export interface RequestConfig {
  requestConfig: HTTP.Config
  getInfoConcurrency: number
}

export interface DebugConfig {
  debug: boolean
}

export type Config = GenerateCommandConfig &
  ImageProtectionConfig &
  OtherCommandConfig &
  ListConfig &
  RequestConfig &
  DebugConfig

const shortcutCmdConfig = Schema.object({
  enableShortcut: Schema.boolean().default(true),
})

const shortcutCmdCfgWithSilent = Schema.intersect([
  shortcutCmdConfig,
  Schema.union([
    Schema.object({
      enableShortcut: Schema.const(true),
      shortcutUsePrefix: Schema.boolean().default(true),
      silentShortcut: Schema.boolean().default(false),
    }),
    Schema.object({}),
  ]),
])

const shortcutCmdCfgWithMoreSilent = Schema.intersect([
  shortcutCmdCfgWithSilent,
  Schema.union([
    Schema.object({
      enableShortcut: Schema.const(true),
      silentShortcut: Schema.const(true).required(),
      moreSilent: Schema.boolean().default(false),
    }),
    Schema.object({}),
  ]),
])

export const GenerateCommandConfig = Schema.intersect([
  shortcutCmdCfgWithMoreSilent,
  Schema.object({
    autoUseDefaultTexts: Schema.boolean().default(true),
    autoUseSenderAvatarWhenOnlyOne: Schema.boolean().default(true),
    autoUseSenderAvatarWhenOneLeft: Schema.boolean().default(true),
    enableProtectedTargetSwap: Schema.boolean().default(false),
    protectedTargetUserId: Schema.string().role('secret').default(''),
  }),
]) as Schema<GenerateCommandConfig>

export const ImageProtectionConfig = Schema.object({
  enableProtectedImageSwap: Schema.boolean().default(false),
  protectedImageMd5List: Schema.array(Schema.string()).role('table').default([]),
}) as Schema<ImageProtectionConfig>

export const ListConfig = Schema.object({
  listSortBy: (Schema.union(Object.values(ListSortBy) as any) as any).default(
    ListSortBy.Keywords,
  ),
  listSortReverse: Schema.boolean().default(false),
  listNewTimeDelta: Schema.natural().min(1).default(30),
  listTextTemplate: Schema.string().default('{keywords}'),
  listAddCategoryIcon: Schema.boolean().default(true),
}) as Schema<ListConfig>

export const OtherCommandConfig = Schema.object({
  randomMemeShowInfo: Schema.boolean().default(true),
  generateSubCommandCountToFather: Schema.boolean().default(false),
  randomCommandCountToGenerate: Schema.boolean().default(false),
}) as Schema<OtherCommandConfig>

export const RequestConfig = Schema.object({
  requestConfig: HTTP.createConfig('http://127.0.0.1:2233'),
  getInfoConcurrency: Schema.natural().min(1).default(8),
}) as Schema<RequestConfig>

export const DebugConfig = Schema.object({
  debug: Schema.boolean().default(false),
}) as Schema<DebugConfig>

export const Config: Schema<Config> = Schema.intersect([
  GenerateCommandConfig,
  ImageProtectionConfig,
  ListConfig,
  OtherCommandConfig,
  RequestConfig,
  DebugConfig,
]).i18n({
  'zh-CN': zhCNLocale._config,
  zh: zhCNLocale._config,
})
