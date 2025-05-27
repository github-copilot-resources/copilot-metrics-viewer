<template>
  <v-container>
    <div>
      <v-toolbar color="indigo" elevation="4">
        <v-btn icon>
          <v-icon>mdi-github</v-icon>
        </v-btn>

        <v-toolbar-title class="toolbar-title"><span v-html="displayName"></span></v-toolbar-title>
        <h2 class="error-message"> {{ mockedDataMessage }} </h2>
        <v-spacer />

        <!-- Conditionally render the logout button -->
        <AuthState>
          <template #default="{ loggedIn, user }">
            <div v-show="loggedIn" class="user-info">
              Welcome,
              <v-avatar class="user-avatar">
                <v-img :alt="user?.name" :src="user?.avatarUrl" />
              </v-avatar> {{ user?.name }}
            </div>
            <v-btn v-if="showLogoutButton && loggedIn" class="logout-button" @click="logout">Logout</v-btn>
          </template>
        </AuthState>

        <template #extension>
          <v-tabs v-model="tab" align-tabs="title">
            <v-tab v-for="item in tabItems" :key="item" :value="item">
              {{ item }}
            </v-tab>
          </v-tabs>
        </template>
      </v-toolbar>

      <!-- API Error Message -->
      <div v-show="apiError && !signInRequired" class="error-message" v-text="apiError" />
      <AuthState>
        <template #default="{ loggedIn }">
          <div v-show="signInRequired" class="github-login-container">
            <NuxtLink v-if="!loggedIn && signInRequired" to="/auth/github" external class="github-login-button"> <v-icon
                left>mdi-github</v-icon>
              Sign in with GitHub</NuxtLink>
          </div>
        </template>
        <template #placeholder>
          <button disabled>Loading...</button>
        </template>
      </AuthState>

      <div v-show="!apiError">
        <!-- Add Date Range Filter Section -->
        <!--This V-card should be show only from Metrics,Languages,Editors and Copilot Chat tabs-->
        <v-card v-if="showDateFilter && (tab === 'metrics' || tab === 'languages' || tab === 'editors' || tab === 'copilot chat')" class="date-filter-section my-4">
          <v-card-text class="d-flex align-center justify-start flex-wrap">
            <div class="text-h6 mr-4">Time Range Filter:</div>
            
            <!-- 预设日期范围选择 -->
            <v-select
              v-model="selectedPreset"
              label="Preset Ranges"
              variant="outlined"
              density="compact"
              :items="presetOptions"
              class="mr-4"
              style="min-width: 150px; max-width: 200px"
              @update:model-value="handlePresetChange"
            ></v-select>
            
            <!-- 或直接输入日期 -->
            <div class="d-flex align-center flex-wrap">
              <span class="mr-2">From:</span>
              <v-menu
                v-model="startDateMenu"
                :close-on-content-click="false"
                transition="scale-transition"
                min-width="auto"
              >
                <template #activator="{ props }">
                  <v-text-field
                    v-model="startDateInput"
                    v-bind="props"
                    label="Start Date"
                    prepend-icon="mdi-calendar"
                    variant="outlined"
                    density="compact"
                    readonly
                    class="mr-4 date-field"
                    style="min-width: 180px"
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="internalStartDate"
                  @update:model-value="handleStartDateChange"
                ></v-date-picker>
              </v-menu>
              
              <span class="mr-2">To:</span>
              <v-menu
                v-model="endDateMenu"
                :close-on-content-click="false"
                transition="scale-transition"
                min-width="auto"
              >
                <template #activator="{ props }">
                  <v-text-field
                    v-model="endDateInput"
                    v-bind="props"
                    label="End Date"
                    prepend-icon="mdi-calendar"
                    variant="outlined"
                    density="compact"
                    readonly
                    class="mr-4 date-field"
                    style="min-width: 180px"
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="internalEndDate"
                  @update:model-value="handleEndDateChange"
                ></v-date-picker>
              </v-menu>
            </div>

            <v-btn
              color="primary"
              @click="applyManualDateFilter"
              class="mr-2"
            >
              <v-icon left class="mr-2">mdi-filter</v-icon>
              Apply Filter
            </v-btn>

            <v-btn
              v-if="filteredMetrics.length && filteredMetrics.length !== metrics.length"
              color="error"
              variant="outlined"
              @click="clearDateFilter"
              class="ml-2"
            >
              <v-icon left class="mr-2">mdi-filter-off</v-icon>
              Clear Filter
            </v-btn>
          </v-card-text>
          <div class="text-subtitle-2 ml-4 mb-2" v-if="dateRangeInfo.message">
            {{ dateRangeInfo.message }}
          </div>
        </v-card>

        <v-progress-linear v-show="!metricsReady" indeterminate color="indigo" />
        <v-window v-show="metricsReady && metrics.length" v-model="tab">
          <v-window-item v-for="item in tabItems" :key="item" :value="item">
            <v-card flat>
              <MetricsViewer v-if="item === 'metrics'" :metrics="filteredMetrics.length ? filteredMetrics : metrics" />
              <BreakdownComponent v-if="item === 'languages'" :metrics="filteredMetrics.length ? filteredMetrics : metrics" :breakdown-key="'language'" />
              <BreakdownComponent v-if="item === 'editors'" :metrics="filteredMetrics.length ? filteredMetrics : metrics" :breakdown-key="'editor'" />
              <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="filteredMetrics.length ? filteredMetrics : metrics" />
              <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
              <ApiResponse
                v-if="item === 'api response'"
                :metrics="filteredMetrics.length ? filteredMetrics : metrics"
                :original-metrics="originalMetrics"
                :seats="seats"
              />
              <MultiTeamsMetricsViewer 
                v-if="item === 'multi-teams metrics'"
                :teams="teams"
              />
            </v-card>
          </v-window-item>
          <v-alert
            v-show="metricsReady && metrics.length === 0"
            density="compact"
            text="No data available to display"
            title="No data"
            type="warning"
          />
        </v-window>

      </div>

    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { MetricsApiResponse } from '@/types/metricsApiResponse';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { RuntimeConfig } from 'nuxt';
import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { Seat } from "@/model/Seat";

// Don't import h3 directly if it's not in the dependencies
// Define H3Error interface locally
interface H3Error {
  statusCode?: number;
  message?: string;
}

//Components
import MetricsViewer from './MetricsViewer.vue';
import BreakdownComponent from './BreakdownComponent.vue';
import CopilotChatViewer from './CopilotChatViewer.vue';
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue';
import ApiResponse from './ApiResponse.vue';
import MultiTeamsMetricsViewer from './MultiTeamsMetricsViewer.vue';

// Temporary fix for RuntimeConfig type issue
const config: any = useRuntimeConfig();

// Ensure `useRoute` is initialized
const route = useRoute();
const router = useRouter();

// Initialize reactive state variables first
// Generated by Zhuang
const metricsReady = ref(false);
const metrics = ref<Metrics[]>([]);
const originalMetrics = ref<CopilotMetrics[]>([]);
const filteredMetrics = ref<Metrics[]>([]);
const seatsReady = ref(false);
const seats = ref<Seat[]>([]);
const teams = ref<string[]>([]);

// API Error Message
const apiError = ref<string | undefined>(undefined);
const showLogoutButton = computed(() => config.public.usingGithubAuth && loggedIn.value);
const mockedDataMessage = computed(() => config.public.isDataMocked ? 'Using mock data - see README if unintended' : '');
const itemName = computed(() => 'metrics'); // 默认显示 metrics 内容
const { loggedIn, user } = useUserSession();

// Tab management
const tab = ref('metrics');
const tabItems = computed(() => {
  // Only include 'multi-teams metrics' when scope is not enterprise
  const items = ['metrics', 'languages', 'editors', 'copilot chat', 'seat analysis'];
  
  // Don't show multi-teams metrics for enterprise scope
  if (config.public.scope !== 'enterprise') {
    items.push('multi-teams metrics');
  }

  if (originalMetrics.value?.length > 0) {
    items.push('api response');
  }

  return items;
});

// 初始化日期相关的状态
const startDateInput = ref('');
const endDateInput = ref('');
const selectedPreset = ref('');
const presetOptions = [
  { title: 'Last 7 Days', value: 'last7Days' },
  { title: 'Last 30 Days', value: 'last30Days' },
  { title: 'This Month', value: 'thisMonth' },
  { title: 'All Available Data', value: 'allData' },
  { title: 'Custom', value: 'custom' }
];

// 日期选择菜单状态
const startDateMenu = ref(false);
const endDateMenu = ref(false);

// 重要：初始化为null，不要使用空字符串
const internalStartDate = ref(null);
const internalEndDate = ref(null);

// Other computed properties
const displayName = computed(() => getDisplayName(config.public));
const signInRequired = computed(() => {
  return config.public.usingGithubAuth && !loggedIn.value;
});
const showDateFilter = computed(() => true); // You can customize this condition

// Generated by Copilot: Watch organization changes to reload teams
watch(() => config.public.githubOrg, async (newOrg: string, oldOrg: string) => {
  console.log(`Organization changed from ${oldOrg} to ${newOrg}, ready to reload teams`);
    
  if (newOrg && newOrg !== oldOrg && config.public.scope === 'org') {
    console.log(`Organization changed from ${oldOrg} to ${newOrg}, reloading teams`);
    await loadTeamsData();
  }
}, { immediate: true });

// Watch for changes in team parameter - direct monitoring of route.params.team
watch(() => route.params.team, async (newTeam: string | undefined, oldTeam: string | undefined) => {
  console.log(`Team route parameter changed: ${oldTeam} -> ${newTeam}`);
  
  if (newTeam !== oldTeam) {
    console.log(`Team changed from ${oldTeam} to ${newTeam}, reloading data...`);
    try {
      // Always force refresh when team changes
      if (newTeam) {
        await loadTeamData(newTeam);
        console.log(`Team data loaded for: ${newTeam}`);
        // Force view update after data load
        await nextTick();
        console.log('View updated for new team data');
      }
    } catch (error) {
      console.error(`Error loading team data for ${newTeam}:`, error);
    }
  }
}, { immediate: true });

// Generated by Copilot: Function to load teams data
async function loadTeamsData() {
  if (config.public.scope === 'org') {
    // Generated by Zhuang: Clear old teams data when organization changes
    teams.value = []; // Reset teams array to clear old data
    
    try {
      // Use $fetch instead of useFetch for components that are already mounted
      const teamsData = await $fetch<any[]>('/api/teams');
      
      if (teamsData && Array.isArray(teamsData)) {
        teams.value = teamsData.map((team: any) => team.name);
        console.log(`Teams loaded for ${config.public.githubOrg}:`, teams.value);
      }
    } catch (teamsError: any) {
      processError(teamsError as H3Error);
    }
  }
}

// Function to load data for the selected team
// Generated by Zhuang
async function loadTeamData(team: string | undefined) {
  if (!team) {
    console.warn('loadTeamData called with undefined team');
    return;
  }

  try {
    console.log(`Loading data for team: ${team}`);

    // Clear existing data
    metrics.value = [];
    filteredMetrics.value = [];
    
    // Reset ready state
    metricsReady.value = false;
    
    // Reset error state
    apiError.value = undefined;

    // Use the existing /api/metrics endpoint with query params
    try {
      // Get organization name from route parameters or config
      const org = route.params.orgName as string || config.public.githubOrg;
      
      console.log(`Fetching team metrics with org: ${org}, team: ${team}`);
      
      // Call the metrics API with proper query parameters format
      const response = await $fetch<MetricsApiResponse>('/api/metrics', {
        query: {  // Use 'query' instead of 'params' for proper URL parameter formatting
          scope: 'team',     // Force team scope
          team: team,        // Set team name from parameter
          org: org           // Set org name
        }
      });
      
      console.log('Team metrics API response received:', !!response);
      
      if (response) {
        // Set new metrics data
        metrics.value = response.metrics || [];
        console.log(`Metrics loaded for team ${team}:`, metrics.value.length);
        
        // Store original metrics data if available
        if (response.usage) {
          originalMetrics.value = response.usage;
        }
        
        // Force update the UI
        metricsReady.value = true;
        await nextTick();
        
        // Update tab to trigger re-render of components
        tab.value = tab.value;
      } else {
        console.error('Empty response received from metrics API');
        apiError.value = 'No data received from API for the selected team';
      }
    } catch (error: any) {
      console.error('Error fetching team metrics:', error);
      processError(error as H3Error);
      // Show specific error for team data
      apiError.value = `Failed to load metrics for team "${team}": ${error.message || 'Unknown error'}`;
    } finally {
      // Ensure UI isn't stuck in loading state
      metricsReady.value = true;
    }
  } catch (e: any) {
    console.error('Error in loadTeamData function:', e);
    metricsReady.value = true; // Ensure UI isn't stuck in loading state
    apiError.value = `Error loading team data: ${e.message || 'Unknown error'}`;
  }
}

// Helper function to get display name based on scope
function getDisplayName(config: any): string {
  switch (config.scope) {
    case 'team':
      // Return a template literal with HTML link for organization
      return `Copilot Metrics Viewer | Organization: <a href="/orgs/${config.githubOrg}" style="color: inherit; text-decoration: underline;">${config.githubOrg}</a> | Team: ${config.githubTeam}`;
    case 'organization':
      if(config.githubTeam) {
        return `Copilot Metrics Viewer | Organization: ${config.githubOrg} | Team: ${config.githubTeam}`;
      }
      else {
        return `Copilot Metrics Viewer | Organization: ${config.githubOrg}`;
      }
    case 'enterprise':
      return `Copilot Metrics Viewer | Enterprise: ${config.githubEnt}`;
    default:
      return 'Copilot Metrics Viewer';
  }
}

/**
 * Handles API errors by setting appropriate error messages.
 * @param {H3Error} error - The error object returned from the API call.
 */
function processError(error: H3Error) {
  console.error(error || 'No data returned from API');
  // Check the status code of the error response
  if (error.statusCode) {
    switch (error.statusCode) {
      case 401:
        apiError.value = '401 Unauthorized access returned by GitHub API - check if your token in the .env (for local runs). Check PAT token and GitHub permissions.';
        break;
      case 404:
        apiError.value = `404 Not Found - is the ${config.public.scope || ''} org:'${config.public.githubOrg || ''} ent:'${config.public.githubEnt || ''}' team:'${config.public.githubTeam}' correct? ${error.message}`;
        break;
      case 500:
        apiError.value = `500 Internal Server Error - most likely a bug in the app. Error: ${error.message}`;
        break;
      default:
        apiError.value = `${error.statusCode} Error: ${error.message}`;
        break;
    }
  }
}

// 日期处理函数
function handleStartDateChange(date: any) {
  if (date) {
    // 确保日期格式为 YYYY-MM-DD
    const formattedDate = formatDateToYYYYMMDD(date);
    startDateInput.value = formattedDate;
    console.log("Start date changed to:", formattedDate);
  }
  startDateMenu.value = false;
}

function handleEndDateChange(date: any) {
  if (date) {
    // 确保日期格式为 YYYY-MM-DD
    const formattedDate = formatDateToYYYYMMDD(date);
    endDateInput.value = formattedDate;
    console.log("End date changed to:", formattedDate);
  }
  endDateMenu.value = false;
}

// 添加辅助函数，确保日期格式为 YYYY-MM-DD
function formatDateToYYYYMMDD(dateStr: any): string {
  // 处理日期对象
  if (dateStr instanceof Date) {
    return formatDateToString(dateStr);
  }
  
  // 处理字符串日期
  try {
    // 尝试将字符串解析为日期对象
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return formatDateToString(date);
    }
  } catch (e) {
    console.error("Error parsing date:", e);
  }
  
  // 如果是YYYY-MM-DD格式的字符串，直接返回
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 默认返回空字符串
  return '';
}

// 添加可用日期范围的计算和显示
const dateRangeInfo = computed(() => {
  if (!metrics.value || metrics.value.length === 0) return { min: '', max: '', message: 'No data available' };
  
  // 提取所有有效日期并排序
  const dates = metrics.value
    .filter((m: Metrics) => m.day)
    .map((m: Metrics) => new Date(m.day))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
  
  if (dates.length === 0) return { min: '', max: '', message: 'No valid dates in data' };
  
  const minDate = formatDateToString(dates[0]);
  const maxDate = formatDateToString(dates[dates.length - 1]);
  
  return {
    min: minDate,
    max: maxDate,
    message: `Available data from ${minDate} to ${maxDate}`
  };
});

// 修改预设处理函数，移除自动应用过滤器的部分
function handlePresetChange(preset: string) {
  if (!preset) return;
  
  // 如果没有数据或者日期，则不做任何操作
  if (!metrics.value || metrics.value.length === 0 || !dateRangeInfo.value.min) {
    alert('No data available to filter');
    return;
  }
  
  if (preset === 'last7Days') {
    // 使用数据中最后一天作为结束日期
    const endDate = new Date(dateRangeInfo.value.max);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 7);
    
    startDateInput.value = formatDateToString(startDate);
    endDateInput.value = formatDateToString(endDate);
    // 移除自动应用过滤器
    // applyManualDateFilter();
  } 
  else if (preset === 'last30Days') {
    // 使用数据中最后一天作为结束日期
    const endDate = new Date(dateRangeInfo.value.max);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 30);
    
    startDateInput.value = formatDateToString(startDate);
    endDateInput.value = formatDateToString(endDate);
    // 移除自动应用过滤器
    // applyManualDateFilter();
  }
  else if (preset === 'thisMonth') {
    // 使用数据中最后一天的月份
    const endDate = new Date(dateRangeInfo.value.max);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    
    startDateInput.value = formatDateToString(startDate);
    endDateInput.value = formatDateToString(lastDayOfMonth);
    // 移除自动应用过滤器
    // applyManualDateFilter();
  }
  else if (preset === 'allData') {
    // 使用所有可用数据的日期范围
    startDateInput.value = dateRangeInfo.value.min;
    endDateInput.value = dateRangeInfo.value.max;
    // 移除自动应用过滤器
    // applyManualDateFilter();
  }
}

// 格式化日期为字符串 YYYY-MM-DD
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(dateStr: string): boolean {
  // 检查日期格式是否为 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  // 尝试解析日期
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// 修改 applyManualDateFilter 函数，恢复到原来的过滤实现方式
function applyManualDateFilter() {
  if (!isValidDateString(startDateInput.value) || !isValidDateString(endDateInput.value)) {
    alert('Please enter valid dates in the format YYYY-MM-DD');
    return;
  }

  const startDate = new Date(startDateInput.value);
  const endDate = new Date(endDateInput.value);

  // 确保开始日期不晚于结束日期
  if (startDate > endDate) {
    alert('Start date cannot be later than end date');
    return;
  }

  // 过滤指定日期范围内的数据
  filteredMetrics.value = metrics.value.filter((metric: Metrics) => {
    if (!metric.day) return false;
    
    const metricDate = new Date(metric.day);
    return metricDate >= startDate && metricDate <= endDate;
  });
}

function clearDateFilter() {
  filteredMetrics.value = [];
  startDateInput.value = '';
  endDateInput.value = '';
  selectedPreset.value = '';
}

function logout() {
  const { clear } = useUserSession();
  metrics.value = [];
  seats.value = [];
  clear();
}

// Initial data fetching
async function fetchInitialData() {
  try {
    // Use $fetch instead of useFetch
    const metricsData = await $fetch<MetricsApiResponse>('/api/metrics');
    
    if (metricsData) {
      metrics.value = metricsData.metrics || [];
      originalMetrics.value = metricsData.usage || [];
      metricsReady.value = true;
    }
  } catch (metricsError: any) {
    processError(metricsError as H3Error);
  }
  
  // Check if we need to show an error for empty metrics
  if (config.public.scope === 'team' && metrics.value.length === 0 && !apiError.value) {
    apiError.value = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
  }
  
  // Fetch seats data
  try {
    const seatsData = await $fetch<Seat[]>('/api/seats');
    seats.value = seatsData || [];
    seatsReady.value = true;
  } catch (seatsError: any) {
    processError(seatsError as H3Error);
  }
  
  // Load teams data if needed
  if (config.public.scope === 'org') {
    await loadTeamsData();
  }
}

// Call fetchInitialData when component is mounted
onMounted(fetchInitialData);
</script>

<style scoped>
/* Ensure the toolbar container adapts to content width */
.v-toolbar {
  flex-wrap: wrap; /* Allow wrapping of child elements */
  max-width: 100%; /* Prevent overflow beyond the screen width */
}

/* Adjust toolbar-title to ensure full visibility without truncation */
.toolbar-title {
  color: #4CAF50; /* Highlight text with green color */
  font-weight: bold; /* Make the text bold */
  font-size: 1.2rem; /* Slightly increase font size */
  white-space: nowrap; /* Prevent text wrapping */
  overflow: visible; /* Ensure text is fully visible */
  text-overflow: clip; /* Disable ellipsis */
  flex: 1 1 auto; /* Allow the title to take up available space */
  min-width: 0; /* Prevent overflow issues */
}

.error-message {
  color: red;
}

.logout-button {
  margin-left: auto;
}

.github-login-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.github-login-button {
  display: flex;
  align-items: center;
  background-color: #24292e;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
}

.github-login-button:hover {
  background-color: #444d56;
}

.github-login-button v-icon {
  margin-right: 8px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  margin-right: 8px;
  margin-left: 8px;
  border: 2px solid white;
}

.date-filter-section {
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.date-filter-section .v-card-text {
  padding: 16px;
}

.date-field {
  cursor: pointer;
}

.date-field:hover {
  border-color: #1976d2;
}

.date-picker {
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
</style>