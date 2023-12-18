<p align="center">
  <img width="807" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/3865c1c1-f087-4f87-b3ad-8550b3cb355b">
</p>

## Charts and Data Visualizations 

This includes a set of charts that visualize various metrics related to GitHub Copilot for your _GitHub Organization_. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and usage of GitHub Copilot. Here are the key metrics visualized in these charts:

### Key Metrics
1. **Acceptance Rate:** This metric represents the ratio of accepted lines to the total lines suggested by GitHub Copilot. This rate is an indicator of the relevance and usefulness of Copilot's suggestions.
<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/875a5f5f-5d8a-44bd-a4e9-0f663f2b2628">
</p>

3. **Total Suggestions** This chart illustrates the total number of code suggestions made by GitHub Copilot. It offers a view of the tool's activity and its engagement with users over time.

4. **Total Acceptances:** This visualization focuses on the total number of suggestions accepted by users. This metric is crucial to understand the effectiveness and accuracy of GitHub Copilot's suggestions.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/b84220ae-fbdc-4503-b50b-4689362bf364">
</p>

4. **Total Lines Suggested:** A detailed chart showcasing the total number of lines of code suggested by GitHub Copilot. This gives an idea of the volume of code generation and assistance provided.

5. **Total Lines Accepted:** This chart compares the total lines of code accepted by users, offering insights into how much of the suggested code is actually being utilized in real-world applications.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/788c9b33-8e63-43a5-9ab9-98d8938dd9d9">
</p>

6. **Total Active Users:** An interactive graph representing the number of active users engaging with GitHub Copilot. This helps in understanding the tool's popularity and user base growth.

<p align="center">
  <img width="600" alt="image" src="https://github.com/martedesco/copilot-metrics-viewer/assets/3329307/bd92918f-3a11-492b-8490-877aaa768ca3">
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

### Coming next 🔮
- Enterprise level charts
- Language breakdown analysis
