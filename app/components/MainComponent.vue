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

      <div v-show="!apiError" name="date-range-filter">
        <!-- Add Date Range Filter Section -->
        <!--This V-card should be show only from Metrics,Languages,Editors and Copilot Chat tabs-->
        <v-card v-if="showDateFilter && (tab === 'metrics' || tab === 'languages' || tab === 'editors' || tab === 'copilot chat')" class="date-filter-section my-4">
          <v-card-text class="d-flex align-center justify-start flex-wrap">
            <div class="text-h6 mr-4">Time Range Filter:</div>

            <!-- Preset date range selection -->
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

            <!-- or select custom date range -->
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
              <!-- <MetricsViewer v-if="item === 'metrics'" :metrics="filteredMetrics.length ? filteredMetrics : metrics" />-->
              <MetricsViewer  
                v-if="item === 'metrics'" 
                :metrics="filteredMetrics.length ? filteredMetrics : metrics" 
                :key="`metrics-viewer-${config.public.githubOrg}-${metrics.length}`" 
              />
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

// Watch for changes in URL route parameters (for both organization and team)
// Generated by Zhuang

// 添加一个标志变量，用于跟踪数据加载状态
const isLoadingData = ref(false);
// 添加一个请求ID变量，用于处理竞态条件
const currentDataLoadId = ref('');

// 添加计算属性来获取当前组织和团队
const currentOrg = computed(() => route.params.org as string || config.public.githubOrg);
const currentTeam = computed(() => route.params.team as string || config.public.githubTeam);
const currentEnt = computed(() => route.params.ent as string || config.public.githubEnt);
// 监听路由参数变化
watch(
  () => ({ org: currentOrg.value, team: currentTeam.value, ent: currentEnt.value }),
  async (newValue, oldValue) => {
    // 确保oldValue存在，防止第一次运行时出错
    oldValue = oldValue || { org: undefined, team: undefined, ent: undefined };

    const newOrgName = newValue?.org;
    const oldOrgName = oldValue?.org;
    const newTeam = newValue?.team;
    const oldTeam = oldValue?.team;
    const newEnt = newValue?.ent;
    const oldEnt = oldValue?.ent;
    // 记录变化情况
    console.log(`Route params change detected - Org: ${oldOrgName || 'none'} -> ${newOrgName || 'none'}, Team: ${oldTeam || 'none'} -> ${newTeam || 'none'}, Ent: ${oldEnt || 'none'} -> ${newEnt || 'none'}`);

    // 如果已经有加载进行中，取消该请求
    if (isLoadingData.value) {
      console.log(`Data loading already in progress. Creating new request.`);
    }
    
    // 生成唯一的数据加载ID
    const loadId = `${newOrgName || 'no-org'}-${newTeam || 'no-team'}-${newEnt || 'no-ent'}-${Date.now()}`;
    currentDataLoadId.value = loadId;
    
    // 设置加载状态标志
    isLoadingData.value = true;
    
    try {      // 情况1: 组织变化或企业变化
      if (newOrgName && newOrgName !== oldOrgName || newEnt && newEnt !== oldEnt) {
        console.log(`[${loadId}] Organization changed: ${oldOrgName} -> ${newOrgName}`);
        console.log(`[${loadId}] Enterprise changed: ${oldEnt} -> ${newEnt}`);

        // 1. 更新配置中的组织值以保持同步
        if (newOrgName && config.public.githubOrg !== newOrgName) {
          config.public.githubOrg = newOrgName as string;
          console.log(`[${loadId}] Updated config.public.githubOrg to: ${config.public.githubOrg}`);
        }
        
        // 更新企业值
        if (newEnt && config.public.githubEnt !== newEnt) {
          config.public.githubEnt = newEnt as string;
          console.log(`[${loadId}] Updated config.public.githubEnt to: ${config.public.githubEnt}`);
        }
        
        // 2. 清空所有相关数据
        metrics.value = [];
        seats.value = [];
        filteredMetrics.value = [];
        originalMetrics.value = [];
        teams.value = [];
        
        // 3. 重置准备状态
        metricsReady.value = false;
        seatsReady.value = false;
        
        // 等待一个渲染周期，确保组件状态已更新
        await nextTick();
        
        // 检查是否仍然是当前加载请求
        if (currentDataLoadId.value !== loadId) {
          console.log(`[${loadId}] Loading cancelled - newer request started`);
          return;
        }
          // Step 1: 获取新组织的指标数据 - 始终使用URL参数
        let metricsUrl = '/api/metrics?';
        
        if (newOrgName) {
          metricsUrl += `org=${encodeURIComponent(newOrgName)}`;
        } else if (newEnt) {
          metricsUrl += `ent=${encodeURIComponent(newEnt)}`;
        }
        
        const metricsData = await $fetch<MetricsApiResponse>(metricsUrl);
        
        // 再次检查是否仍然是当前加载请求
        if (currentDataLoadId.value !== loadId) {
          console.log(`[${loadId}] Loading cancelled after metrics fetch - newer request started`);
          return;
        }
        
        if (metricsData) {
          // 使用深拷贝创建全新对象，避免引用问题
          const newMetricsData = JSON.parse(JSON.stringify(metricsData.metrics || []));
          const newOriginalData = JSON.parse(JSON.stringify(metricsData.usage || []));
          
          metrics.value = newMetricsData;
          originalMetrics.value = newOriginalData;
          console.log(`[${loadId}] Metrics loaded: ${metrics.value.length} records`);
        }
          // Step 2: 获取新组织或企业的座位数据 - 始终使用URL参数
        let seatsUrl = '/api/seats?';
        
        if (newOrgName) {
          seatsUrl += `org=${encodeURIComponent(newOrgName)}`;
        } else if (newEnt) {
          seatsUrl += `ent=${encodeURIComponent(newEnt)}`;
        }
        
        const seatsData = await $fetch<Seat[]>(seatsUrl);
        
        // 再次检查请求有效性
        if (currentDataLoadId.value !== loadId) return;
        
        if (Array.isArray(seatsData)) {
          seats.value = JSON.parse(JSON.stringify(seatsData));
          console.log(`[${loadId}] Seats data loaded: ${seats.value.length} seats`);
        }
        
        // Step 3: 如果需要且是组织范围，加载团队数据
        if (config.public.scope === 'org' && newOrgName) {
          await loadTeamsData(newOrgName);
        }
        
        // 检查请求有效性
        if (currentDataLoadId.value !== loadId) return;
        
        // 4. 等待UI更新并设置就绪状态
        await nextTick();
        metricsReady.value = true;
        seatsReady.value = true;
        
        console.log(`[${loadId}] Complete data reload finished`);
      }
      // 情况2: 仅团队变化（组织和企业不变）
      else if (newTeam && newTeam !== oldTeam) {
        console.log(`[${loadId}] Team changed: ${oldTeam} -> ${newTeam}`);
        
        // 1. 更新配置中的团队值以保持同步
        if (config.public.githubTeam !== newTeam) {
          config.public.githubTeam = newTeam as string;
          console.log(`[${loadId}] Updated config.public.githubTeam to: ${config.public.githubTeam}`);
        }
        
        // 2. 只重新加载团队特定的指标数据
        await loadTeamData(newTeam, newOrgName);
        
        // 检查是否仍然是当前加载请求
        if (currentDataLoadId.value !== loadId) return;
        
        console.log(`[${loadId}] Metrics data reloaded for team: ${newTeam}`);
      }
      // 情况3: 初始加载或其他变化
      else if (immediate) {
        console.log(`[${loadId}] Initial data load or other change`);
        // 加载初始数据
        await fetchInitialData();
      }
    } catch (error) {
      console.error(`[${loadId}] Error loading data:`, error);
      processError(error as H3Error);
    } finally {
      // 重置加载状态标志
      if (currentDataLoadId.value === loadId) {
        isLoadingData.value = false;
      }
    }
  }, 
  { 
    immediate: true, 
    deep: true 
  }
);

// 移除旧的监听器 - 不再直接监听config.public.githubOrg和config.public.githubTeam
// watch(
//   () => ({ 
//     org: config.public.githubOrg, 
//     team: config.public.githubTeam 
//   }), 
//   async (newValue, oldValue) => {
//     // 旧的监听逻辑...
//   }
// );

// 标记初始加载标志，用于immediate调用
const immediate = true;

// Remove any direct watches on config.public.githubOrg since we're now handling everything through route params

// Helper function to load all data for an organization or enterprise
// Generated by Zhuang
async function loadOrganizationData(orgName: string, entName?: string) {
  // Clear existing data
  metrics.value = [];
  seats.value = [];
  filteredMetrics.value = [];
  originalMetrics.value = [];
  teams.value = [];
  
  // Reset ready states
  metricsReady.value = false;
  seatsReady.value = false;
  
  try {
    if (orgName) {
      console.log(`Loading all data for organization: ${orgName}`);
    } else if (entName) {
      console.log(`Loading all data for enterprise: ${entName}`);
    }
    
    // 构建API URL，包含组织或企业参数
    let metricsUrl = '/api/metrics?';
    let queryParams = [];
    
    if (orgName) {
      queryParams.push(`org=${encodeURIComponent(orgName)}`);
    }
    
    if (entName) {
      queryParams.push(`ent=${encodeURIComponent(entName)}`);
    }
    
    // 添加查询参数到URL
    metricsUrl += queryParams.join('&');
    
    console.log("Fetching metrics with URL:", metricsUrl);
    
    // Fetch metrics data
    const metricsData = await $fetch<MetricsApiResponse>(metricsUrl);
    
    if (metricsData) {
      metrics.value = metricsData.metrics || [];
      originalMetrics.value = metricsData.usage || [];
    }
    
    // 构建座位API URL
    let seatsUrl = '/api/seats?';
    seatsUrl += queryParams.join('&');
    
    console.log("Fetching seats with URL:", seatsUrl);
    
    // Fetch seats data
    const seatsData = await $fetch<Seat[]>(seatsUrl);
    
    if (Array.isArray(seatsData)) {
      seats.value = seatsData;
    }
    
    // Load teams if scope is org and we have an orgName
    if (config.public.scope === 'org' && orgName) {
      await loadTeamsData(orgName);
    }
    
    // Wait for UI updates
    await nextTick();
    
    // Update ready states
    metricsReady.value = true;
    seatsReady.value = true;
    
    if (orgName) {
      console.log(`Data load complete for organization ${orgName}`);
    } else if (entName) {
      console.log(`Data load complete for enterprise ${entName}`);
    } else {
      console.log(`Data load complete`);
    }
  } catch (error) {
    console.error('Error loading data:', error);
    processError(error as H3Error);
  }
}

// Generated by Copilot: Function to load teams data
async function loadTeamsData(orgName?: string) {
  if (config.public.scope === 'org') {
    // Generated by Zhuang: Clear old teams data when organization changes
    teams.value = []; // Reset teams array to clear old data
    
    // 优先使用提供的组织名，其次使用当前组织
    const orgToUse = orgName || currentOrg.value;
    
    try {
      // 使用URL参数传递组织名
      const teamsData = await $fetch<any[]>(`/api/teams?organization=${encodeURIComponent(orgToUse)}`);
      
      if (teamsData && Array.isArray(teamsData)) {
        teams.value = teamsData.map((team: any) => team.name);
        console.log(`Teams loaded for ${orgToUse}:`, teams.value);
      }
    } catch (teamsError: any) {
      processError(teamsError as H3Error);
    }
  }
}

// Function to load data for the selected team - Only updates metrics
// Generated by Zhuang
async function loadTeamData(team: string | undefined, orgName?: string, entName?: string) {
  if (!team) {
    console.warn('loadTeamData called with undefined team');
    return;
  }

  try {
    console.log(`Loading metrics data for team: ${team}`);

    // 只清除metrics相关数据，不重置seats和teams
    metrics.value = [];
    filteredMetrics.value = [];
    originalMetrics.value = [];
    
    // 重置指标准备状态
    metricsReady.value = false;
    
    // 重置错误状态
    apiError.value = undefined;

    // 使用当前组织/企业和新团队获取指标数据
    try {
      // 获取组织名和企业名，优先使用传入的参数，其次使用路由参数，最后使用配置
      const org = orgName || currentOrg.value;
      const ent = entName || currentEnt.value;
      
      // 构建API URL
      let queryParams = ['scope=team'];
      
      if (team) {
        queryParams.push(`team=${encodeURIComponent(team)}`);
      }
      
      if (org) {
        queryParams.push(`org=${encodeURIComponent(org)}`);
      }
      
      if (ent) {
        queryParams.push(`ent=${encodeURIComponent(ent)}`);
      }
      
      const metricsUrl = `/api/metrics?${queryParams.join('&')}`;
      
      console.log(`Fetching team metrics with URL: ${metricsUrl}`);
      
      // 调用metrics API获取团队特定的指标 - 始终通过URL传递参数
      const response = await $fetch<MetricsApiResponse>(metricsUrl);
      
      console.log('Team metrics API response received:', !!response);
      
      if (response) {
        // 设置新的指标数据
        metrics.value = response.metrics || [];
        if (response.usage) {
          originalMetrics.value = response.usage;
        }
        
        console.log(`Metrics loaded for team ${team}:`, metrics.value.length);
        
        // 更新UI和状态
        metricsReady.value = true;
        await nextTick();
      } else {
        console.error('Empty response received from metrics API');
        apiError.value = 'No data received from API for the selected team';
      }
    } catch (error: any) {
      console.error('Error fetching team metrics:', error);
      processError(error as H3Error);
      apiError.value = `Failed to load metrics for team "${team}": ${error.message || 'Unknown error'}`;
    } finally {
      // 确保UI不会卡在加载状态
      metricsReady.value = true;
    }
  } catch (e: any) {
    console.error('Error in loadTeamData function:', e);
    metricsReady.value = true;
    apiError.value = `Error loading team data: ${e.message || 'Unknown error'}`;
  }
}

// Helper function to get display name based on scope
function getDisplayName(config: any): string {
  // 使用路由参数优先于配置
  const org = route.params.org as string || config.githubOrg;
  const team = route.params.team as string || config.githubTeam;
  const ent = route.params.ent as string || config.githubEnt;
  
  switch (config.scope) {
    case 'team':
      // Return a template literal with HTML link for organization
      return `Copilot Metrics Viewer | Organization: <a href="/orgs/${org}" style="color: inherit; text-decoration: underline;">${org}</a> | Team: ${team}`;
    case 'organization':
      if(team) {
        return `Copilot Metrics Viewer | Organization: ${org} | Team: ${team}`;
      }
      else {
        return `Copilot Metrics Viewer | Organization: ${org}`;
      }
    case 'enterprise':
      return `Copilot Metrics Viewer | Enterprise: ${ent}`;
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
    .map((m: Metrics) => m.day ? new Date(m.day) : null)
    .filter((date: Date | null): date is Date => date !== null)
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

// 修改预设处理函数，修复变量重复声明问题
// Generated by Zhuang
function handlePresetChange(preset: string) {
  if (!preset) return;
  
  // 如果没有数据或者日期范围信息，则不做任何操作
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
  } 
  else if (preset === 'last30Days') {
    // 使用数据中最后一天作为结束日期
    const endDate = new Date(dateRangeInfo.value.max);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 30);
    
    startDateInput.value = formatDateToString(startDate);
    endDateInput.value = formatDateToString(endDate);
  }
  else if (preset === 'thisMonth') {
    // 使用数据中最后一天的月份
    const endDate = new Date(dateRangeInfo.value.max);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    
    startDateInput.value = formatDateToString(startDate);
    endDateInput.value = formatDateToString(lastDayOfMonth);
  }
  else if (preset === 'allData') {
    // 使用所有可用数据的日期范围
    startDateInput.value = dateRangeInfo.value.min;
    endDateInput.value = dateRangeInfo.value.max;
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
    // 获取当前组织名，优先使用路由参数
    const orgName = currentOrg.value;
    const teamName = currentTeam.value;
    const entName = currentEnt.value; // 添加企业名称支持
    
    // 构建API URL，适应组织或企业参数
    let metricsUrl = '/api/metrics';
    
    // 优先使用组织参数，如果没有则使用企业参数
    if (orgName) {
      metricsUrl += `?org=${encodeURIComponent(orgName)}`;
      
      // 如果有团队参数且scope为team，添加团队和scope参数
      if (teamName && config.public.scope === 'team') {
        metricsUrl += `&team=${encodeURIComponent(teamName)}&scope=team`;
      }
    } else if (entName) {
      metricsUrl += `?ent=${encodeURIComponent(entName)}`;
    }
    
    // 获取指标数据
    const metricsData = await $fetch<MetricsApiResponse>(metricsUrl);
    
    if (metricsData) {
      metrics.value = metricsData.metrics || [];
      originalMetrics.value = metricsData.usage || [];
      metricsReady.value = true;
    }
  } catch (metricsError: any) {
    processError(metricsError as H3Error);
  }
  
  // 检查是否需要显示空指标的错误
  if (config.public.scope === 'team' && metrics.value.length === 0 && !apiError.value) {
    apiError.value = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
  }
  
  try {
    // 获取当前组织名，优先使用路由参数
    const orgName = currentOrg.value;
    const entName = currentEnt.value; // 添加企业名称支持
    
    // 构建API URL
    let seatsUrl = '/api/seats';
    
    // 优先使用组织参数，如果没有则使用企业参数
    if (orgName) {
      seatsUrl += `?org=${encodeURIComponent(orgName)}`;
    } else if (entName) {
      seatsUrl += `?ent=${encodeURIComponent(entName)}`;
    }
    
    // 获取座位数据
    const seatsData = await $fetch<Seat[]>(seatsUrl);
    seats.value = seatsData || [];
    seatsReady.value = true;
  } catch (seatsError: any) {
    processError(seatsError as H3Error);
  }
  
  // 加载团队数据（如果需要）
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