// TypeScript
import axios from "axios";
import { Seat } from "../model/Seat";

import organizationMockedResponse_seats from '../assets/organization_response_sample_seats.json';
import enterpriseMockedResponse_seats from '../assets/enterprise_response_sample_seats.json';

export const getSeatsApi = async (): Promise<Seat[]> => {
  const perPage = 50;
  let page = 1;
  let seatsData: Seat[] = [];

  let response;
  if (process.env.VUE_APP_SCOPE !== "organization") {
    // when the scope is not organization, return seatsData,by default it will return empty array
    return seatsData;
  }
  else{
    if (process.env.VUE_APP_MOCKED_DATA === "true") {
      response = organizationMockedResponse_seats;
      seatsData = seatsData.concat(response.seats.map((item: any) => new Seat(item)));
    } 
    else if (process.env.VUE_APP_MOCKED_DATA === "false") {
    // Fetch the first page to get the total number of seats
      response = await axios.get(`https://api.github.com/orgs/${process.env.VUE_APP_GITHUB_ORG}/copilot/billing/seats`, {
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
        response = await axios.get(`https://api.github.com/orgs/${process.env.VUE_APP_GITHUB_ORG}/copilot/billing/seats`, {
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
      } //end of else if (process.env.VUE_APP_MOCKED_DATA === "false")
  }  //end of else if (process.env.VUE_APP_SCOPE !== "organization")
  return seatsData;
}
}