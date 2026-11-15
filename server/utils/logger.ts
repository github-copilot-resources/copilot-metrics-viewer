import { createConsola, LogLevels, type ConsolaReporter, type LogType } from 'consola'

type SupportedLogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'
type LogMethod = (message: string, ...args: unknown[]) => void

export interface TaggedLogger {
  error: LogMethod
  warn: LogMethod
  info: LogMethod
  debug: LogMethod
}

const DEFAULT_LEVEL: SupportedLogLevel = 'info'
const LEVELS: Record<SupportedLogLevel, number> = {
  silent: LogLevels.silent,
  error: LogLevels.error,
  warn: LogLevels.warn,
  info: LogLevels.info,
  debug: LogLevels.debug,
}

interface LoggingConfig {
  logLevel?: string
  logFormat?: string
  logRequests?: string | boolean
}

export function getRuntimeLoggingConfig(): LoggingConfig {
  try {
    const runtimeConfig = (globalThis as unknown as { useRuntimeConfig?: () => unknown }).useRuntimeConfig
    if (typeof runtimeConfig === 'function') {
      return runtimeConfig() as LoggingConfig
    }
    if (typeof useRuntimeConfig === 'function') {
      return useRuntimeConfig() as LoggingConfig
    }
  } catch {
    // useRuntimeConfig is unavailable in standalone scripts and some tests.
  }
  return {
    logLevel: process.env.NUXT_LOG_LEVEL,
    logFormat: process.env.NUXT_LOG_FORMAT,
    logRequests: process.env.NUXT_LOG_REQUESTS,
  }
}

export function normalizeLogLevel(level: unknown): SupportedLogLevel {
  return typeof level === 'string' && Object.hasOwn(LEVELS, level) ? level as SupportedLogLevel : DEFAULT_LEVEL
}

export function isLogLevelAtLeast(level: unknown, minimum: SupportedLogLevel): boolean {
  const normalized = normalizeLogLevel(level)
  if (normalized === 'silent') return false
  return LEVELS[normalized] >= LEVELS[minimum]
}

function shouldUseJsonFormat(format: unknown): boolean {
  return format === 'json' || (format !== 'pretty' && process.env.NODE_ENV === 'production')
}

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
}

// Error messages, stacks, causes and upstream payloads can contain OAuth codes,
// signed URLs or personal data. Only explicitly operational metadata is emitted.
function serializeArg(arg: unknown): Record<string, unknown> {
  if (!arg || typeof arg !== 'object') return {}
  const source = arg as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  if (arg instanceof Error) {
    fields.name = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'FetchError', 'H3Error'].includes(arg.name)
      ? arg.name : 'Error'
  }
  for (const key of ['status', 'statusCode', 'durationMs', 'count', 'errorCount', 'keyCount']) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) fields[key] = value
  }
  if (isValidRequestId(source.requestId)) fields.requestId = source.requestId
  if (typeof source.method === 'string' && /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|CONNECT|TRACE)$/.test(source.method)) {
    fields.method = source.method
  }
  if (typeof source.path === 'string' && source.path.startsWith('/')) {
    fields.path = source.path.split(/[?#]/, 1)[0]
  }
  if (typeof source.responseType === 'string' && ['string', 'object', 'number', 'undefined', 'boolean'].includes(source.responseType)) {
    fields.responseType = source.responseType
  }
  if (typeof source.code === 'string' && /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENOENT)$/.test(source.code)) {
    fields.code = source.code
  }
  return fields
}

function consoleMethodFor(type: LogType): 'error' | 'warn' | 'info' | 'debug' {
  if (type === 'error' || type === 'fatal') return 'error'
  if (type === 'warn') return 'warn'
  if (type === 'debug' || type === 'trace' || type === 'verbose') return 'debug'
  return 'info'
}

function createReporter(json: boolean): ConsolaReporter {
  return {
    log(logObj) {
      const [message, ...args] = logObj.args
      const method = consoleMethodFor(logObj.type)

      if (json) {
        const fields = args[0] && typeof args[0] === 'object'
          ? args[0] as Record<string, unknown>
          : undefined
        const extra = fields ? args.slice(1) : args
        console[method](JSON.stringify({
          timestamp: logObj.date.toISOString(),
          level: logObj.type,
          tag: logObj.tag,
          message,
          ...fields,
          ...(extra.length > 0 ? { args: extra } : {}),
        }))
        return
      }

      const prefix = logObj.tag ? `[${logObj.tag}]` : ''
      console[method](prefix, message, ...args)
    }
  }
}

export function createLogger(tag: string, context?: Record<string, unknown>): TaggedLogger {
  const log = (type: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: unknown[]) => {
    const config = getRuntimeLoggingConfig()
    const level = normalizeLogLevel(config.logLevel)
    if (!isLogLevelAtLeast(level, type)) return

    const logger = createConsola({
      level: LEVELS.debug,
      reporters: [createReporter(shouldUseJsonFormat(config.logFormat))],
    }).withTag(tag)

    const safeArgs = args.map(serializeArg)
    if (context && isValidRequestId(context.requestId)) {
      const fields = safeArgs[0] || {}
      fields.requestId = context.requestId
      safeArgs[0] = fields
    }
    logger[type](message, ...safeArgs)
  }

  return {
    error: (message, ...args) => log('error', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    info: (message, ...args) => log('info', message, ...args),
    debug: (message, ...args) => log('debug', message, ...args),
  }
}
