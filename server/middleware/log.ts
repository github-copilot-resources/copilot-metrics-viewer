export default defineEventHandler((event) => {
  console.log('Request: ' + event.method + ' ' + getRequestURL(event))
})