export default defineEventHandler(async (event) => {
  const logger = console;
  const apiUrl = `https://api.github.com/orgs/${event.context.org}/teams?per_page=100`;

  try {
    const response = (await $fetch(apiUrl, {
      headers: event.context.headers,
    })) as unknown[];
    const teamList = response.map((item) => item.slug);
    return { data: teamList };
  } catch (error) {
    logger.error('Error fetching teams data:', error);
    return new Response('Error fetching teams data: ' + error, {
      status: error.statusCode || 500,
    });
  }
});
