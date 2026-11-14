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

export function getRuntimeLoggingConfig(): { logLevel?: string; logFormat?: string; logRequests?: string } {
  try {
    const runtimeConfig = (globalThis as unknown as { useRuntimeConfig?: () => unknown }).useRuntimeConfig
    if (typeof runtimeConfig === 'function') {
      return runtimeConfig() as { logLevel?: string; logFormat?: string; logRequests?: string }
    }
    if (typeof useRuntimeConfig === 'function') {
      return useRuntimeConfig() as { logLevel?: string; logFormat?: string; logRequests?: string }
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
  return typeof level === 'string' && level in LEVELS ? level as SupportedLogLevel : DEFAULT_LEVEL
}

export function isLogLevelAtLeast(level: unknown, minimum: SupportedLogLevel): boolean {
  const normalized = normalizeLogLevel(level)
  if (normalized === 'silent') return false
  return LEVELS[normalized] >= LEVELS[minimum]
}

function shouldUseJsonFormat(format: unknown): boolean {
  return format === 'json' || (format !== 'pretty' && process.env.NODE_ENV === 'production')
}

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
      cause: arg.cause,
    }
  }
  return arg
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
        const fields = args.length === 1 && args[0] && typeof args[0] === 'object' && !(args[0] instanceof Error)
          ? args[0] as Record<string, unknown>
          : undefined
        const extra = fields ? args.slice(1) : args
        console[method](JSON.stringify({
          timestamp: logObj.date.toISOString(),
          level: logObj.type,
          tag: logObj.tag,
          message: typeof message === 'string' ? message : serializeArg(message),
          ...fields,
          ...(extra.length > 0 ? { args: extra.map(serializeArg) } : {}),
        }))
        return
      }

      const prefix = logObj.tag ? `[${logObj.tag}]` : ''
      console[method](prefix, message, ...args)
    }
  }
}

export function createLogger(tag: string): TaggedLogger {
  const log = (type: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: unknown[]) => {
    const config = getRuntimeLoggingConfig()
    const level = normalizeLogLevel(config.logLevel)
    if (!isLogLevelAtLeast(level, type)) return

    const logger = createConsola({
      level: LEVELS.debug,
      reporters: [createReporter(shouldUseJsonFormat(config.logFormat))],
    }).withTag(tag)

    logger[type](message, ...args)
  }

  return {
    error: (message, ...args) => log('error', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    info: (message, ...args) => log('info', message, ...args),
    debug: (message, ...args) => log('debug', message, ...args),
  }
}
