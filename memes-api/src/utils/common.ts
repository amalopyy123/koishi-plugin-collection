import type { FileResponse } from '@cordisjs/plugin-http'
import { createHash } from 'node:crypto'
import { h } from 'koishi'

export function checkInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

export function constructBlobFromFileResp(resp: FileResponse): Blob {
  return new Blob([resp.data], { type: resp.type })
}

export async function computeBlobMd5(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer())
  return createHash('md5').update(buffer).digest('hex')
}

export function normalizeMd5(value: string): string {
  return value.trim().toLowerCase()
}

export function formatRange(min: number, max: number): string {
  return min === max ? min.toString() : `${min} ~ ${max}`
}

export function formatKeywords(keywords: string[]): string {
  return keywords.map((value) => `"${value}"`).join('、')
}

export function listJoin<T, V>(list: T[], splitter: V): (T | V)[] {
  const newList: (T | V)[] = []
  for (const item of list) {
    newList.push(item)
    newList.push(splitter)
  }
  newList.pop()
  return newList
}

export function listFlatJoin<T, V>(list: T[][], splitter: V[]): (T | V)[] {
  const newList: (T | V)[] = []
  for (let i = 0; i < list.length - 1; i += 1) {
    newList.push(...list[i])
    newList.push(...splitter)
  }
  newList.push(...list[list.length - 1])
  return newList
}

export function transformRegex(
  pythonRegex: string,
): { pattern: string; flags: string } {
  let flags = ''
  let pattern = pythonRegex

  pattern = pattern.replace(/\(\?([imsux]+)\)/g, (_, nextFlags: string) => {
    flags += nextFlags.replace('x', '')
    return ''
  })
  pattern = pattern.replace(/\(\?P<(\w+?)>/g, '(?<$1>')

  return { pattern, flags }
}

export function extractContentPlaintext(content: string): string {
  let elements: h[]
  try {
    elements = h.parse(content)
  } catch {
    return content
  }

  const textBuffer: string[] = []
  const visit = (element: h) => {
    if (element.children.length) {
      for (const child of element.children) visit(child)
    }
    if (element.type === 'text') {
      const text = element.attrs.content
      if (text) textBuffer.push(text)
    }
  }

  for (const child of elements) visit(child)
  return textBuffer.join('')
}

export function replaceBracketVar(value: string, res: RegExpExecArray): string {
  return value.replace(/(?<l>[^\{])?\{(?<v>.+?)\}(?<r>[^\}])?/g, (...args) => {
    type Groups = Record<'l' | 'r', string | undefined> & Record<'v', string>
    const { l, v, r } = args[args.length - 1] as Groups
    const index = parseInt(v, 10)

    let resolved: string
    if (!Number.isNaN(index)) {
      resolved = res[index] ?? v
    } else if (res.groups && v in res.groups) {
      resolved = res.groups[v]
    } else {
      resolved = v
    }

    return `${l ?? ''}${extractContentPlaintext(resolved)}${r ?? ''}`
  })
}

export function isVersionMeets(version: string, minVersion: number[]): boolean {
  const parts = version.split('.').map((value) => parseInt(value, 10))
  for (let i = 0; i < minVersion.length; i += 1) {
    const part = Number.isNaN(parts[i]) ? 0 : (parts[i] ?? 0)
    const minPart = minVersion[i] ?? 0
    if (part < minPart) return false
  }
  return true
}
