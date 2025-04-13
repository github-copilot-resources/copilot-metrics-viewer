<template>
  <v-container>
    <div>
      <v-toolbar color="indigo" elevation="4">
        <v-btn icon>
          <v-icon>mdi-github</v-icon>
        </v-btn>

        <v-toolbar-title class="toolbar-title">{{ displayName }}</v-toolbar-title>
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
        <v-card v-if="showDateFilter" class="date-filter-section my-4">
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

// /* const router = useRouter();
// const route = useRoute(); */

const config = useRuntimeConfig();

// Tab management
const tab = ref('metrics');
const tabItems = computed(() => {
  // Generated by Copilot
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

// Generated by Copilot: Watch organization changes to reload teams
watch(() => config.public.githubOrg, async (newOrg, oldOrg) => {
  console.log(`Organization changed from ${oldOrg} to ${newOrg}, ready to reload teams`);
    
  if (newOrg && newOrg !== oldOrg && config.public.scope === 'org') {
    console.log(`Organization changed from ${oldOrg} to ${newOrg}, reloading teams`);
    await loadTeamsData();
  }
}, { immediate: true });

// Generated by Copilot: Function to load teams data
async function loadTeamsData() {
  if (config.public.scope === 'org') {
    // Generated by Copilot: Clear old teams data when organization changes
    teams.value = []; // Reset teams array to clear old data
    
    const teamsFetch = useFetch('/api/teams');
    const { data: teamsData, error: teamsError } = await teamsFetch;
    
    if (teamsError.value) {
      processError(teamsError.value as H3Error);
    } else if (teamsData.value) {
      teams.value = teamsData.value.map((team: any) => team.name);
      console.log(`Teams loaded for ${config.public.githubOrg}:`, teams.value);
    }
  }
}

// Helper function to get display name based on scope
function getDisplayName(config: any): string {

  switch (config.scope) {
    case 'team':
      return `Copilot Metrics Viewer | Organization： ${config.githubOrg} | Team： ${config.githubTeam}`;
      //return `Copilot Metrics Viewer | Team： ${config.githubTeam}`;
    case 'organization':
      if(config.githubTeam) {
        return `Copilot Metrics Viewer | Organization： ${config.githubOrg} | Team： ${config.githubTeam}`;
      }
      else {
        return `Copilot Metrics Viewer | Organization： ${config.githubOrg}`;
      }
    case 'enterprise':
      return `Copilot Metrics Viewer | Enterprise： ${config.githubEnt} `;
    default:
      return 'Copilot Metrics Viewer';
  }
}

import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { Seat } from "@/model/Seat";
import type { H3Error } from 'h3'

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue'
import CopilotChatViewer from './CopilotChatViewer.vue'
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'
import MultiTeamsMetricsViewer from './MultiTeamsMetricsViewer.vue'

const { loggedIn, user } = useUserSession()
const showLogoutButton = computed(() => config.public.usingGithubAuth && loggedIn.value);
const mockedDataMessage = computed(() => config.public.isDataMocked ? 'Using mock data - see README if unintended' : '');
const itemName = computed(() => 'metrics'); // 默认显示 metrics 内容
//const githubInfo = getDisplayName(config.public)
//const displayName = computed(() => githubInfo);


const displayName = computed(() => getDisplayName(config.public));


const metricsReady = ref(false);
const metrics = ref<Metrics[]>([]);
const originalMetrics = ref<CopilotMetrics[]>([]);
const seatsReady = ref(false);
const seats = ref<Seat[]>([]);
const teams = ref<string[]>([]);

// API Error Message
const apiError = ref<string | undefined>(undefined);
const signInRequired = computed(() => {
  return config.public.usingGithubAuth && !loggedIn.value;
});

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

const metricsFetch = useFetch('/api/metrics');
const seatsFetch = useFetch('/api/seats');

const { data: metricsData, error: metricsError } = await metricsFetch;
if (metricsError.value || !metricsData.value) {
  processError(metricsError.value as H3Error);
} else {
  const apiResponse = metricsData.value as MetricsApiResponse;
  metrics.value = apiResponse.metrics || [];
  originalMetrics.value = apiResponse.usage || [];
  metricsReady.value = true;
}

// Ensure originalMetrics is loaded
if (metricsData.value) {
  const apiResponse = metricsData.value as MetricsApiResponse;
  metrics.value = apiResponse.metrics || [];
  originalMetrics.value = apiResponse.usage || [];
  metricsReady.value = true;
}

if (config.public.scope === 'team' && metrics.value.length === 0 && !apiError.value) {
  apiError.value = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
}

// Ensure teams data is loaded
//Todo: check whether the below code is needed, as it will fetch all teams for an org
// why it is needed here? and the config.public.scope === 'organization', not org
if (config.public.scope === 'org') {
  const teamsFetch = useFetch('/api/teams');
  const { data: teamsData, error: teamsError } = await teamsFetch;
  
  if (teamsError.value) {
    processError(teamsError.value as H3Error);
  } else if (teamsData.value) {
    teams.value = teamsData.value.map((team: any) => team.name);
    console.log("Teams data loaded in Main Component:", teams.value);
  }
}

const { data: seatsData, error: seatsError } = await seatsFetch;
if (seatsError.value) {
  processError(seatsError.value as H3Error);
} else {
  seats.value = seatsData.value || [];
  seatsReady.value = true;
}

function logout() {
  const { clear } = useUserSession()
  metrics.value = [];
  seats.value = [];
  clear();
}

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

// Filtered metrics
const filteredMetrics = ref<Metrics[]>([]);

// 日期选择菜单状态
const startDateMenu = ref(false);
const endDateMenu = ref(false);

// 重要：初始化为null，不要使用空字符串
const internalStartDate = ref(null);
const internalEndDate = ref(null);

// 日期处理函数
function handleStartDateChange(date) {
  if (date) {
    // 确保日期格式为 YYYY-MM-DD
    const formattedDate = formatDateToYYYYMMDD(date);
    startDateInput.value = formattedDate;
    console.log("Start date changed to:", formattedDate);
  }
  startDateMenu.value = false;
}

function handleEndDateChange(date) {
  if (date) {
    // 确保日期格式为 YYYY-MM-DD
    const formattedDate = formatDateToYYYYMMDD(date);
    endDateInput.value = formattedDate;
    console.log("End date changed to:", formattedDate);
  }
  endDateMenu.value = false;
}

// 添加辅助函数，确保日期格式为 YYYY-MM-DD
function formatDateToYYYYMMDD(dateStr) {
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
    .filter(m => m.day)
    .map(m => new Date(m.day))
    .sort((a, b) => a.getTime() - b.getTime());
  
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

// 修改 applyManualDateFilter 函数，恢复到原来的过滤实现方式
function applyManualDateFilter() {
  if (!isValidDateString(startDateInput.value) || !isValidDateString(endDateInput.value)) {
    alert('Please enter valid dates in the format YYYY-MM-DD');
    return;
  }

  try {
    const startDate = parseDate(startDateInput.value);
    const endDate = parseDate(endDateInput.value);
    
    // 确保结束日期是当天的最后一刻
    endDate.setHours(23, 59, 59, 999);
    
    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }
    
    // 记录过滤前状态
    console.log('Before filtering: metrics length =', metrics.value.length);
    console.log('Before filtering: filteredMetrics length =', filteredMetrics.value.length);
    
    // 首先清空过滤结果数组，然后重新过滤
    filteredMetrics.value = [];
    
    // 等待一个微任务周期，确保视图更新
    nextTick().then(() => {
      filteredMetrics.value = metrics.value.filter(item => {
        if (!item.day) return false;
        // 正确解析日期 - day 格式为 "YYYY-MM-DD"
        const itemDate = new Date(item.day);
        return itemDate >= startDate && itemDate <= endDate;
      });
      
      // 强制通知组件更新
      tab.value = tab.value;
      
      console.log(`Filtered metrics from ${startDate} to ${endDate}, found ${filteredMetrics.value.length} items`);
      console.log('First few filtered items:', filteredMetrics.value.slice(0, 3).map(m => m.day));
      console.log('After filtering: filteredMetrics length =', filteredMetrics.value.length);
      
      if (filteredMetrics.value.length === 0) {
        alert(`No data found between ${startDateInput.value} and ${endDateInput.value}. Available data is from ${dateRangeInfo.value.min} to ${dateRangeInfo.value.max}.`);
      }
    });
    
  } catch (e) {
    console.error('Error applying date filter:', e);
    alert('Error filtering by date: ' + e);
  }
}

// 验证日期字符串格式
function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// 解析日期字符串
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// 清除日期过滤器
function clearDateFilter() {
  startDateInput.value = '';
  endDateInput.value = '';
  selectedPreset.value = '';
  
  // 首先清空数组，然后重新赋值，确保视图刷新
  filteredMetrics.value = [];
  
  nextTick().then(() => {
    filteredMetrics.value = [...metrics.value];
    
    // 强制通知组件更新
    tab.value = tab.value;
    
    console.log('Filter cleared. Showing all', filteredMetrics.value.length, 'metrics');
  });
}

// 添加计算属性，判断当前Tab是否需要显示日期选择器
const showDateFilter = computed(() => {
  // 只在这些标签页上显示日期选择器
  const tabsWithDateFilter = ['metrics', 'languages', 'editors', 'copilot chat'];
  return tabsWithDateFilter.includes(tab.value);
});
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