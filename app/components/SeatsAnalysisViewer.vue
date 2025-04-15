<template>
    <div class="tiles-container">
        <v-card
elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">Total Assigned  </div>
                    <div class="text-caption">
                        Currently assigned seats
                    </div>
                    <p class="text-h4">{{ totalSeats.length }}</p>
                </div>
            </v-card-item>
        </v-card>

        <v-card
elevation="4" color="white" variant="elevated" class="mx-auto my-3"
            style="width: 300px; height: 175px;">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">Assigned But Never Used</div>
                    <div class="text-caption">
                        No show seats
                    </div>
                    <p class="text-h4">{{ noshowSeats }}</p>
                </div>
            </v-card-item>
        </v-card>
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 330px; height: 175px;">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 7 days </div>
                    <div class="text-caption">
                        No use in the last 7 days
                    </div>
                    <p class="text-h4">{{ unusedSeatsInSevenDays }}</p>
                </div>
            </v-card-item>
        </v-card>
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 330px; height: 175px;">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 30 days </div>
                    <div class="text-caption">
                        No use in the last 30 days
                    </div>
                    <p class="text-h4">{{ unusedSeatsInThirtyDays }}</p>
                </div>
            </v-card-item>
        </v-card>
    </div>
    
    <div>
        <v-main class="p-1" style="min-height: 300px;">
            <v-container style="min-height: 300px;" class="px-4 elevation-2">
                <br>
                <h2>All assigned seats </h2>
                <br>
            <v-data-table :headers="headers" :items="totalSeats" :items-per-page="10" class="elevation-2">
                <template #item="{ item, index }">
                    <tr>
                        <td>{{ index + 1 }}</td>
                        <td>{{ item.login }}</td>
                        <td>{{ item.id }}</td>
                        <td>{{ item.team }}</td>
                        <td>{{ item.created_at }}</td>
                        <td>{{ item.last_activity_at }}</td>
                        <td>{{ item.last_activity_editor }}</td>
                    </tr>
                </template>
                </v-data-table>
            </v-container>
        </v-main>
    </div>
</template>
  
<script lang="ts">
  import { defineComponent, ref, watchEffect } from 'vue';
  import type { Seat } from '@/model/Seat';
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
                    if(!Boolean(seat.last_activity_at)) {
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
