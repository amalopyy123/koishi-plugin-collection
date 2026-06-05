import type {} from '@koishijs/plugin-help'
import type { Notifier } from '@koishijs/plugin-notifier'
import { Context } from 'koishi'
import { MemeAPI, MemeError, MemeInfoResponse } from 'meme-generator-api'

import * as Commands from './commands'
import { Config } from './config'
import zhCNLocale from './locales/zh-CN'
import * as Utils from './utils'

export { Config }

export const name = 'memes-api'

export const usage = `
<style>
.memes-api-usage {
  background-color: var(--k-side-bg);
  padding: 1px 24px;
  border-radius: 4px;
  border-left: 4px solid var(--k-color-primary);
}

.memes-api-usage a {
  color: var(--k-color-primary-tint);
}

.memes-api-usage a:hover {
  color: var(--primary);
}

.k-comment.success > ul > li:has(a[href^='/commands/memes-api/generate/']) {
  display: none;
}

.k-comment.success > ul > li:has(a[href^='/commands/memes-api/generate'])::after {
  content: '（子命令已隐藏）';
  font-size: 12px;
  color: var(--k-text-normal);
}
</style>

<div class="memes-api-usage">
自用，基于 Python 版 meme 后端的 Koishi 表情包插件自定义分支
</div>
`.trim()

export const inject = {
  required: ['http'],
  optional: ['notifier'],
}

export interface MemePublic {
  get api(): MemeAPI
  get apiVersion(): string
  get infos(): Record<string, MemeInfoResponse>
}
export interface MemeInternal {
  $public: MemePublic
  notifier?: Notifier
  api: MemeAPI
}
declare module 'koishi' {
  interface Context {
    $: MemeInternal
    memesApi: MemePublic
  }
}

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', zhCNLocale)
  ctx.i18n.define('zh', zhCNLocale)

  // isolate new context for plugin internal use
  ctx = ctx.isolate('$')
  ctx.set('$', {})

  ctx.$.api = new MemeAPI(ctx.http.extend(config.requestConfig))

  await Utils.apply(ctx, config)

  ctx.inject(['notifier'], () => {
    ctx.$.notifier = ctx.notifier.create()
  })
  ctx.$.notifier?.update({ type: 'primary', content: '插件初始化中……' })

  try {
    await ctx.$.updateInfos()
  } catch (e) {
    ctx.logger.warn('Failed to fetch data from backend, plugin will not work')
    ctx.logger.warn(e)
    const is404 = e instanceof MemeError && e.response.status === 404
    ctx.$.notifier?.update({
      type: 'danger',
      content: (
        <p>
          从后端获取相关信息失败，插件将不会工作！
          <br />
          {is404 ? (
            <>
              你或许还没有正确连接到 Python 版 `meme` 后端？
              请检查后端部署与请求地址配置。更多信息请查看日志。
            </>
          ) : (
            <>请检查你的请求设置以及 Python 版 `meme` 后端的部署状态，更多信息请查看日志。</>
          )}
        </p>
      ),
    })
    return
  }

  try {
    await Commands.apply(ctx, config)
    await ctx.$.reRegisterGenerateCommands()
    await ctx.$.refreshShortcuts?.()
  } catch (e) {
    try {
      ctx.$.cmd?.dispose()
    } catch (_) {}
    ctx.logger.warn('Failed to initialize, plugin will not work')
    ctx.logger.warn(e)
    ctx.$.notifier?.update({
      type: 'danger',
      content: (
        <p>
          注册插件指令时出错，插件将不会工作！
          <br />
          更多信息请查看日志。
        </p>
      ),
    })
    return
  }

  ctx.$.$public = {
    get api() {
      return ctx.$.api
    },
    get infos() {
      return ctx.$.infos
    },
    get apiVersion() {
      return ctx.$.apiVersion
    },
  }
  ctx.set('memesApi', ctx.$.$public)

  const memeCount = Object.keys(ctx.$.infos).length
  const minVersion = [0, 1, 0]
  const versionMeets = Utils.isVersionMeets(ctx.$.apiVersion, minVersion)
  ctx.$.notifier?.update({
    type: versionMeets ? 'success' : 'warning',
    content: (
      <p>
        {versionMeets ? (
          <></>
        ) : (
          <>
            警告：后端版本需大于等于 {minVersion.join('.')}
            ，否则插件可能无法正常使用！
            <br />
          </>
        )}
        插件初始化完毕，后端版本 {ctx.$.apiVersion}，共载入 {memeCount} 个表情。
      </p>
    ),
  })
  ctx.logger.info(
    `Plugin initialized successfully` +
      `, backend version ${ctx.$.apiVersion}, loaded ${memeCount} memes`,
  )
}
