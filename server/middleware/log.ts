import { randomUUID } from 'node:crypto'
import { createLogger, getRuntimeLoggingConfig, isLogLevelAtLeast } from '../utils/logger'

const logger = createLogger('request')
const HEALTH_PATHS = new Set(['/api/health', '/api/live', '/api/ready'])
const STATIC_PREFIXES = ['/_nuxt/', '/assets/']
const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/i

function getPath(url?: string): string {
  try {
    return new URL(url || '/', 'http://localhost').pathname
  } catch {
    return '/'
  }
}

function getRequestId(event: any): string {
  const header = event.node.req.headers?.['x-request-id']
  if (Array.isArray(header)) return header[0] || randomUUID()
  return header || randomUUID()
}

function shouldSkipPath(path: string): boolean {
  return HEALTH_PATHS.has(path)
    || STATIC_PREFIXES.some(prefix => path.startsWith(prefix))
    || STATIC_FILE_PATTERN.test(path)
}

export default defineEventHandler((event) => {
  const requestId = getRequestId(event)
  event.context.requestId = requestId
  event.node.res.setHeader('x-request-id', requestId)

  const path = getPath(event.node.req.url)
  if (shouldSkipPath(path)) return

  const config = getRuntimeLoggingConfig()
  const forceRequestLogs = config.logRequests === 'true'
  if (!forceRequestLogs && !isLogLevelAtLeast(config.logLevel, 'debug')) return

  const startedAt = Date.now()
  event.node.res.on('finish', () => {
    const payload = {
      method: event.method || event.node.req.method,
      path,
      status: event.node.res.statusCode,
      durationMs: Date.now() - startedAt,
      requestId,
    }
    if (forceRequestLogs) {
      logger.info('Request completed', payload)
    } else {
      logger.debug('Request completed', payload)
    }
  })
})