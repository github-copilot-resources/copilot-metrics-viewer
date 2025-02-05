import { Seat } from "@/model/Seat";
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineEventHandler(async (event) => {

  const config = useRuntimeConfig(event);
  let apiUrl = '';
  let mockedDataPath: string;

  switch (event.context.scope) {
    case 'team':
    case 'org':
      apiUrl = `https://api.github.com/orgs/${event.context.org}/copilot/billing/seats`;
      mockedDataPath = resolve('public/mock-data/organization_seats_response_sample.json');
      break;
    case 'ent':
      apiUrl = `https://api.github.com/enterprises/${event.context.ent}/copilot/billing/seats`;
      mockedDataPath = resolve('public/mock-data/enterprise_seats_response_sample.json');
      break;
    default:
      return new Response('Invalid configuration/parameters for the request', { status: 400 });
  }

  if (config.public.isDataMocked && mockedDataPath) {
    const path = mockedDataPath;
    const data = readFileSync(path, 'utf8');
    const dataJson = JSON.parse(data);
    const seatsData = dataJson.seats.map((item: unknown) => new Seat(item));
    return seatsData;
  }

  if (!event.context.headers.has('Authorization')) {
    return new Response('No Authentication provided', { status: 401 });
  }

  const perPage = 100;
  let page = 1;
  let response = await $fetch(apiUrl, {
    headers: event.context.headers,
    params: {
      per_page: perPage,
      page: page
    }
  }) as { seats: unknown[], total_seats: number };

  let seatsData = response.seats.map((item: unknown) => new Seat(item));

  // Calculate the total pages
  const totalSeats = response.total_seats;
  const totalPages = Math.ceil(totalSeats / perPage);

  // Fetch the remaining pages
  for (page = 2; page <= totalPages; page++) {
    response = await $fetch(apiUrl, {
      headers: event.context.headers,
      params: {
        per_page: perPage,
        page: page
      }
    }) as { seats: unknown[], total_seats: number };

    seatsData = seatsData.concat(response.seats.map((item: unknown) => new Seat(item)));
  }

  return seatsData;
})