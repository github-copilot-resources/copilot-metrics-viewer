<p align="center">
  <img width="807" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/3865c1c1-f087-4f87-b3ad-8550b3cb355b">
</p>

## Video

https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/6d5b3ffd-ef4f-4c47-b0fe-177181fabd99

## Charts

This application includes a set of charts to visualize various metrics related to GitHub Copilot for your _GitHub Organization_. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and adoption of GitHub Copilot. 

## Key Metrics
Here are the key metrics visualized in these charts:
1. **Acceptance Rate:** This metric represents the ratio of accepted lines to the total lines suggested by GitHub Copilot. This rate is an indicator of the relevance and usefulness of Copilot's suggestions.
<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/875a5f5f-5d8a-44bd-a4e9-0f663f2b2628">
</p>

3. **Total Suggestions** This chart illustrates the total number of code suggestions made by GitHub Copilot. It offers a view of the tool's activity and its engagement with users over time.

4. **Total Acceptances:** This visualization focuses on the total number of suggestions accepted by users. 

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/b84220ae-fbdc-4503-b50b-4689362bf364">
</p>

4. **Total Lines Suggested:** Showcases the total number of lines of code suggested by GitHub Copilot. This gives an idea of the volume of code generation and assistance provided.

5. **Total Lines Accepted:** As the name says, the total lines of code accepted by users (full acceptances) offering insights into how much of the suggested code is actually being utilized incorporated to the codebase.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/788c9b33-8e63-43a5-9ab9-98d8938dd9d9">
</p>

6. **Total Active Users:** Represents the number of active users engaging with GitHub Copilot. This helps in understanding the user base growth and adoption rate.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/bd92918f-3a11-492b-8490-877aaa768ca3">
</p>

## Languages Breakdown Analysis

The language breakdown analysis at the bottom of the page displays a table showing the Accepted Prompts, Accepted Lines of Code, and Acceptance Rate (%) for each language over the full time period covered by a single API call. The entries are sorted by the number of _accepted lines of code descending_.

<p align="center">
  <img width="697" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/c6163664-bb2c-4277-8d77-51a50f252df7">
</p>

## Requirements

Your organization must be enrolled in the GitHub Copilot API private alpha.

## Setup instructions

- Instructions on how to authenticate are provided in the API documentation - available if you have access to the private alpha.
- Edit the .env file in the root directory of the project and add the following variables:

```
  VUE_APP_GITHUB_ORG=
  VUE_APP_GITHUB_TOKEN=
```


## Running 
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Coming next 🔮
- Enterprise level charts
