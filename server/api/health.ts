export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.public.version,
    uptime: process.uptime()
  };
});