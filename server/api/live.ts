export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  
  // Basic liveness check - application is alive and responsive
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    version: config.public.version,
    pid: process.pid,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };
});