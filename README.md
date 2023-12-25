<p align="center">
  <img width="807" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/3865c1c1-f087-4f87-b3ad-8550b3cb355b">
</p>

## Charts and Data Visualizations

This application displays a set of charts to visualize various metrics related to GitHub Copilot for your organization leveraging the GitHub Copilot Metrics API, current distributed in private alpha. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and usage of GitHub Copilot. Here are the key metrics visualized in these charts:

### Key Metrics

1. **Total Suggestions:** This chart illustrates the total number of code suggestions made by GitHub Copilot. It offers a view of the tool's activity and its engagement with users over time.

2. **Total Acceptances:** This visualization focuses on the total number of suggestions accepted by users. This metric is crucial to understand the effectiveness and accuracy of GitHub Copilot's suggestions.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/b3b8ce00-26e1-424e-9bd6-000f2245ad6b">
</p>

4. **Total Lines Suggested:** A detailed chart showcasing the total number of lines of code suggested by GitHub Copilot. This gives an idea of the volume of code generation and assistance provided.

5. **Total Lines Accepted:** This chart compares the total lines of code accepted by users, offering insights into how much of the suggested code is actually being utilized in real-world applications.
<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/8c63920e-35e7-4a09-a7bc-2df2f5f03492">
</p>

6. **Total Active Users:** An interactive graph representing the number of active users engaging with GitHub Copilot. This helps in understanding the tool's popularity and user base growth.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/879d627c-0267-456e-b456-a583d1ca368a">
</p>



### Language Breakdown Analysis

The language breakdown analysis at the bottom of the page displays a table showing the Accepted Prompts, Accepted Lines of Code, and Acceptance Rate (%) for each language over the full time period covered by a single API call.

<p align="center">
  <img width="697" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/c6163664-bb2c-4277-8d77-51a50f252df7">
</p>

## Requirements

Your organization must be enrolled in the [GitHub Copilot API private alpha]([url](https://docs.github.com/en/early-access/copilot/copilot-usage-api)).

## Project setup

Edit the .env file in the root directory of the project and add the following variables:

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

### Coming soon 🔮
Enterprise level charts
