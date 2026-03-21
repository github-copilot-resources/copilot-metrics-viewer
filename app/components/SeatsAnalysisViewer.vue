<template>
  <div>
    <!-- Summary tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 330px; height: 175px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Total Assigned  </div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">This metric represents the total number of Copilot seats assigned {{ isTeamView ? `to team "${currentTeam}"` : 'within the current organization/enterprise' }}.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">
              {{ isTeamView ? `Seats assigned to team "${currentTeam}"` : 'Currently assigned seats' }}
            </div>
            <p class="text-h4">{{ totalSeatsCount }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Assigned But Never Used</div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">This metric shows seats that were assigned but never used {{ isTeamView ? `within team "${currentTeam}"` : 'within the current organization/enterprise' }}. The assigned timestamp is also displayed in the chart.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">
              No show seats{{ totalPages > 1 ? ' (this page)' : '' }}
            </div>
            <p class="text-h4">{{ noshowSeats }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 330px; height: 175px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">No Activity in the Last 7 days </div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Never used seats or seats used, but with no activity in the past 7 days.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">
              No use in the last 7 days{{ totalPages > 1 ? ' (this page)' : '' }}
            </div>
            <p class="text-h4">{{ unusedSeatsInSevenDays }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 330px; height: 175px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">No Activity in the Last 30 days </div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">This metric represents seats with no activity in the last 30 days, including those never used.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">
              No use in the last 30 days{{ totalPages > 1 ? ' (this page)' : '' }}
            </div>
            <p class="text-h4">{{ unusedSeatsInThirtyDays }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <!-- Seats history chart (historical / DB mode only) -->
    <div v-if="seatsHistory.length > 0">
      <v-main class="p-1">
        <v-container class="px-4 elevation-2">
          <br>
          <h2>Seat Count History</h2>
          <div class="text-caption mb-4">Daily snapshots collected by the sync job</div>
          <Line :data="historyChartData" :options="historyChartOptions" />
        </v-container>
      </v-main>
    </div>

    <!-- Seats table with server-side pagination -->
    <div>
      <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2">
          <br>
          <h2>All assigned seats</h2>
          <div v-if="totalPages > 1" class="text-caption mb-2">
            Showing page {{ currentPage }} of {{ totalPages }} ({{ totalSeatsCount }} total seats, {{ seats.length }} on this page)
          </div>
          <br>
          <v-data-table :headers="headers" :items="sortedSeats" :items-per-page="-1" hide-default-footer class="elevation-2">
            <template #item="{ item, index }">
              <tr>
                <td>{{ (currentPage - 1) * perPage + index + 1 }}</td>
                <td>{{ item.login }}</td>
                <td>{{ item.id }}</td>
                <td>{{ item.team }}</td>
                <td>{{ item.created_at }} {{ item.plan_type }}</td>
                <td>{{ item.last_activity_at }}</td>
                <td>{{ item.last_activity_editor }}</td>
              </tr>
            </template>
          </v-data-table>

          <!-- Paginator -->
          <div v-if="totalPages > 1" class="d-flex justify-center mt-4">
            <v-pagination
              :model-value="currentPage"
              :length="totalPages"
              :total-visible="7"
              @update:model-value="$emit('page-change', $event)"
            />
          </div>
        </v-container>
      </v-main>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watchEffect, computed, type PropType } from 'vue';
import type { Seat } from '@/model/Seat';
import type { SeatHistoryEntry } from '../../server/storage/seats-storage';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default defineComponent({
  name: 'SeatsAnalysisViewer',
  components: { Line },
  props: {
    seats: {
      type: Array as PropType<Seat[]>,
      required: true,
      default: () => []
    },
    /** Total seats count from the API (may be larger than seats.length on paginated responses) */
    totalSeatsCount: {
      type: Number,
      default: 0
    },
    currentPage: {
      type: Number,
      default: 1
    },
    totalPages: {
      type: Number,
      default: 1
    },
    perPage: {
      type: Number,
      default: 300
    },
    /** Time-series seat history (DB / historical mode only). Empty array hides the chart. */
    seatsHistory: {
      type: Array as PropType<SeatHistoryEntry[]>,
      default: () => []
    }
  },
  emits: ['page-change'],
  setup(props) {
    const noshowSeats            = ref<number>(0);
    const unusedSeatsInSevenDays  = ref<number>(0);
    const unusedSeatsInThirtyDays = ref<number>(0);

    watchEffect(() => {
      if (!props.seats || !Array.isArray(props.seats)) return;

      const oneWeekAgo    = new Date();
      const thirtyDaysAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let noshowCount = 0;
      let unusedIn7   = 0;
      let unusedIn30  = 0;

      for (const seat of props.seats) {
        if (!seat.last_activity_at) {
          noshowCount++;
        } else {
          const lastActivity = new Date(seat.last_activity_at);
          if (lastActivity < oneWeekAgo)    unusedIn7++;
          if (lastActivity < thirtyDaysAgo) unusedIn30++;
        }
      }

      noshowSeats.value            = noshowCount;
      unusedSeatsInSevenDays.value  = unusedIn7;
      unusedSeatsInThirtyDays.value = unusedIn30;
    });

    // Sort seats: null activity first, then ascending by date
    const sortedSeats = computed(() =>
      [...props.seats].sort((a, b) => {
        if (!a.last_activity_at) return -1;
        if (!b.last_activity_at) return  1;
        return new Date(a.last_activity_at) > new Date(b.last_activity_at) ? 1 : -1;
      })
    );

    const config      = useRuntimeConfig();
    const isTeamView  = computed(() => config.public.scope?.includes('team') && config.public.githubTeam);
    const currentTeam = computed(() => config.public.githubTeam || '');

    // Seats history chart datasets
    const historyChartData = computed(() => ({
      labels: props.seatsHistory.map(e => e.snapshot_date),
      datasets: [
        {
          label: 'Total Seats',
          data: props.seatsHistory.map(e => e.total_seats),
          borderColor: 'rgba(63, 81, 181, 1)',
          backgroundColor: 'rgba(63, 81, 181, 0.15)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Never Active',
          data: props.seatsHistory.map(e => e.never_active),
          borderColor: 'rgba(244, 67, 54, 0.9)',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Inactive 7d',
          data: props.seatsHistory.map(e => e.inactive_7d),
          borderColor: 'rgba(255, 152, 0, 0.9)',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          fill: false,
          tension: 0.3,
        },
      ],
    }));

    const historyChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { left: 80, right: 80, top: 20, bottom: 40 } },
      scales: { y: { beginAtZero: true } },
    };

    return {
      noshowSeats,
      unusedSeatsInSevenDays,
      unusedSeatsInThirtyDays,
      sortedSeats,
      isTeamView,
      currentTeam,
      historyChartData,
      historyChartOptions,
    };
  },
  data() {
    return {
      headers: [
        { title: 'S.No',                 key: 'serialNumber' },
        { title: 'Login',                key: 'login' },
        { title: 'GitHub ID',            key: 'id' },
        { title: 'Assigning team',       key: 'team' },
        { title: 'Assigned time',        key: 'created_at' },
        { title: 'Last Activity At',     key: 'last_activity_at' },
        { title: 'Last Activity Editor', key: 'last_activity_editor' },
      ],
    };
  },
});
</script>
