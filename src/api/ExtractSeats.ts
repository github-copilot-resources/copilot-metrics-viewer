// TypeScript
import axios from "axios";
import { Seat } from "../model/Seat";

import organizationMockedResponse_seats from '../assets/organization_response_sample_seats.json';
import enterpriseMockedResponse_seats from '../assets/enterprise_response_sample_seats.json';

export const getSeatsApi = async (): Promise<Seat[]> => {
  const perPage = 50;
  let page = 1;
  let seatUrl = `https://api.github.com/`;
  let seatsData: Seat[] = [];

  let response;
  

  if (process.env.VUE_APP_MOCKED_DATA === "true") {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
      if (process.env.VUE_APP_SCOPE === "organization") {
        response = organizationMockedResponse_seats;
      } 
      else if (process.env.VUE_APP_SCOPE === "enterprise") {
        response = enterpriseMockedResponse_seats;
      }
      else {
        throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization" or "enterprise".`);
      }
      seatsData = seatsData.concat(response.seats.map((item: any) => new Seat(item)));
      return seatsData;
  }
  else {
    // if VUE_APP_GITHUB_TOKEN is not set, throw an error
    if (!process.env.VUE_APP_GITHUB_TOKEN) {
      throw new Error("VUE_APP_GITHUB_TOKEN environment variable is not set.");
      return seatsData;
    }
    else if (process.env.VUE_APP_SCOPE === "organization") {
      seatUrl=seatUrl+`orgs/${process.env.VUE_APP_GITHUB_ORG}/copilot/billing/seats`;
    }
    else if (process.env.VUE_APP_SCOPE === "enterprise") {
      seatUrl=seatUrl+`enterprises/${process.env.VUE_APP_GITHUB_ENT}/copilot/billing/seats`;
    }
    else {
      throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization" or "enterprise".`);
      return seatsData;
    }

    // Fetch the first page to get the total number of seats
    response = await axios.get(seatUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      params: {
        per_page: perPage,
        page: page
      }
    });

    seatsData = seatsData.concat(response.data.seats.map((item: any) => new Seat(item)));
    // Calculate the total pages
    const totalSeats = response.data.total_seats;
    const totalPages = Math.ceil(totalSeats / perPage);

    // Fetch the remaining pages
    for (page = 2; page <= totalPages; page++) {
      response = await axios.get(seatUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        params: {
          per_page: perPage,
          page: page
        }
      });
      seatsData = seatsData.concat(response.data.seats.map((item: any) => new Seat(item)));
    }
    return seatsData;
    } 
  }
