<template>
    <div class="tiles-container">
        <MetricCard
          title="Total Assigned"
          :value="totalSeats.length.toString()"
          description="Currently assigned seats"
          icon="mdi-account-multiple"
          color="primary"
          :is-dark-theme="isDarkTheme"
        />
        
        <MetricCard
          title="Assigned But Never Used"
          :value="noshowSeats.toString()"
          description="No show seats"
          icon="mdi-account-off"
          color="error"
          :is-dark-theme="isDarkTheme"
        />
        
        <MetricCard
          title="No Activity in the Last 7 days"
          :value="unusedSeatsInSevenDays.toString()"
          description="No use in the last 7 days"
          icon="mdi-calendar-week"
          color="warning"
          :is-dark-theme="isDarkTheme"
        />
        
        <MetricCard
          title="No Activity in the Last 30 days"
          :value="unusedSeatsInThirtyDays.toString()"
          description="No use in the last 30 days"
          icon="mdi-calendar-month"
          color="info"
          :is-dark-theme="isDarkTheme"
        />
    </div>
    
    <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2 chart-container">
            <h2 class="breakdown-title">All assigned seats</h2>
            <v-data-table 
              :headers="headers" 
              :items="totalSeats" 
              :items-per-page="10" 
              class="data-table elevation-2"
            >
                <template #item="{ item, index }">
                    <tr class="data-table-row">
                        <td class="data-table-cell">{{ index + 1 }}</td>
                        <td class="data-table-cell">{{ item.login }}</td>
                        <td class="data-table-cell">{{ item.id }}</td>
                        <td class="data-table-cell">{{ item.team }}</td>
                        <td class="data-table-cell">{{ item.created_at }}</td>
                        <td class="data-table-cell">{{ item.last_activity_at }}</td>
                        <td class="data-table-cell">{{ item.last_activity_editor }}</td>
                    </tr>
                </template>
            </v-data-table>
        </v-container>
    </v-main>
</template>
  
<script lang="ts">
  import { defineComponent, ref, watchEffect } from 'vue';
  import type { Seat } from '@/model/Seat';
  import MetricCard from './MetricCard.vue';
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
    } from 'chart.js'

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
)

export default defineComponent({
name: 'SeatsAnalysisViewer',
props: {
        seats: {
            type: Array as () => Seat[],
            required: true,
            default: () => []  
        },
        isDarkTheme: {
            type: Boolean,
            default: false
        }
    },
setup(props) {
    const totalSeats = ref<Seat[]>([]);
        const noshowSeats = ref<number>(0);
        const unusedSeatsInSevenDays = ref<number>(0);
        const unusedSeatsInThirtyDays = ref<number>(0);

        let noshowCount = 0;
        let unusedIn7Count = 0;
        let unusedIn30Count = 0;

        watchEffect(() => {
            if (props.seats && Array.isArray(props.seats)) {
                totalSeats.value = props.seats;

                const oneWeekAgo = new Date();
                const thirtyDaysAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                props.seats.forEach(seat => {
                    if(!seat.last_activity_at) {
                        noshowCount++;
                    } else {
                        const lastActivityDate = new Date(seat.last_activity_at);
                        if (lastActivityDate < oneWeekAgo) {
                            unusedIn7Count++;
                        }
                        if (lastActivityDate < thirtyDaysAgo) {
                            unusedIn30Count++;
                        }
                    }
                });

                // to sort totalSeats by last_activity_at
                totalSeats.value.sort((a, b) => {
                    if (a.last_activity_at === null) {
                        return -1;
                    }
                    if (b.last_activity_at === null) {
                        return 1;
                    }
                    return new Date(a.last_activity_at) > new Date(b.last_activity_at) ? 1 : -1;
                });
            } else {
                throw new Error('Invalid number of seats');
            }

        });

        noshowSeats.value = noshowCount;
        unusedSeatsInSevenDays.value = unusedIn7Count;
        unusedSeatsInThirtyDays.value = unusedIn30Count;

        return {
            totalSeats,
            noshowSeats: noshowSeats,
            unusedSeatsInSevenDays: unusedSeatsInSevenDays,
            unusedSeatsInThirtyDays: unusedSeatsInThirtyDays
        }
},
data() {
    return {
        headers: [
            { title: 'S.No', key: 'serialNumber'},
            { title: 'Login', key: 'login' },
            { title: 'GitHub ID', key: 'id' },
            { title: 'Assigning team', key: 'team' },
            { title: 'Assigned time', key: 'created_at' },
            { title: 'Last Activity At', key: 'last_activity_at' },
            { title: 'Last Activity Editor', key: 'last_activity_editor' },
        ],
    };
}   
  
});
</script>

<style scoped>
.breakdown-title {
  color: #8BE9FD;
  font-weight: 700;
  font-size: 1.5rem;
  margin: 16px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
}

.chart-container {
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

/* Data table styling for better readability */
.data-table {
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.v-data-table__thead) {
  background-color: rgba(100, 216, 203, 0.1) !important;
}

:deep(.v-data-table__thead th) {
  color: #8BE9FD !important;
  font-weight: 600 !important;
  font-size: 0.8rem !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.data-table-cell {
  color: #F8F8F2 !important;
  padding: 12px 16px;
}

:deep(.v-data-table__tbody tr:hover) {
  background-color: rgba(100, 216, 203, 0.05) !important;
}
</style>