<template>
    <div class="tiles-container">
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('totalAssigned')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">Total Assigned </div>
                    <div class="text-caption">
                        Currently assigned seats
                    </div>
                    <p class="text-h4">{{ totalSeats.length }}</p>
                </div>
            </v-card-item>
        </v-card>

        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3"
            style="width: 300px; height: 175px;" @click="selectCategory('assignedButNeverUsed')">
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
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('noActivity7Days')">
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
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('noActivity30Days')">
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

        <!-- New card for 60 days inactive users -->
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('noActivity60Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 60 days </div>
                    <div class="text-caption">
                        No use in the last 60 days
                    </div>
                    <p class="text-h4">{{ unusedSeatsInSixtyDays }}</p>
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
                <v-data-table :headers="headers" :items="filteredSeats" :items-per-page="10" class="elevation-2">
                    <template v-slot:item="{ item, index }">
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
import { Seat } from '../model/Seat';
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
    data() {
        return {
            headers: [
                { title: 'S.No', key: 'serialNumber' },
                { title: 'Login', key: 'login' },
                { title: 'GitHub ID', key: 'id' },
                { title: 'Assigning team', key: 'team' },
                { title: 'Assigned time', key: 'created_at' },
                { title: 'Last Activity At', key: 'last_activity_at' },
                { title: 'Last Activity Editor', key: 'last_activity_editor' },
            ],
            selectedCategory: 'totalAssigned' // Generated by Copilot: Add state to track selected category
        };
    },
    setup(props) {
        let totalSeats = ref<Seat[]>([]);
        const noshowSeats = ref<number>(0);
        const unusedSeatsInSevenDays = ref<number>(0);
        const unusedSeatsInThirtyDays = ref<number>(0);
        const unusedSeatsInSixtyDays = ref<number>(0); // Add new ref

        let noshowCount = 0;
        let unusedIn7Count = 0;
        let unusedIn30Count = 0;
        let unusedIn60Count = 0; // Add new counter

        watchEffect(() => {
            if (props.seats && Array.isArray(props.seats)) {
                totalSeats.value = props.seats;

                const oneWeekAgo = new Date();
                const thirtyDaysAgo = new Date();
                const sixtyDaysAgo = new Date(); // Add new date
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60); // Add new date calculation

                props.seats.forEach(seat => {
                    if (seat.last_activity_at === null) {
                        noshowCount++;
                    } else {
                        const lastActivityDate = new Date(seat.last_activity_at);
                        if (lastActivityDate < oneWeekAgo) {
                            unusedIn7Count++;
                        }
                        if (lastActivityDate < thirtyDaysAgo) {
                            unusedIn30Count++;
                        }
                        if (lastActivityDate < sixtyDaysAgo) { // Add new condition
                            unusedIn60Count++;
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
        unusedSeatsInSixtyDays.value = unusedIn60Count; // Add new value assignment

        return {
            totalSeats,
            noshowSeats: noshowSeats,
            unusedSeatsInSevenDays: unusedSeatsInSevenDays,
            unusedSeatsInThirtyDays: unusedSeatsInThirtyDays,
            unusedSeatsInSixtyDays: unusedSeatsInSixtyDays // Add to return object
        }
    },
    computed: {
        filteredSeats() {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            switch (this.selectedCategory) { // Generated by Copilot: Filter seats based on selected category
                case 'assignedButNeverUsed':
                    return this.totalSeats.filter(seat => seat.last_activity_at === null);
                case 'noActivity7Days':
                    return this.totalSeats.filter(seat => seat.last_activity_at && new Date(seat.last_activity_at) < oneWeekAgo);
                case 'noActivity30Days':
                    return this.totalSeats.filter(seat => seat.last_activity_at && new Date(seat.last_activity_at) < thirtyDaysAgo);
                case 'noActivity60Days':
                    return this.totalSeats.filter(seat => seat.last_activity_at && new Date(seat.last_activity_at) < sixtyDaysAgo);
                default:
                    return this.totalSeats;
            }
        }
    },
    methods: {
        selectCategory(category: string) { // Generated by Copilot: Method to update selected category
            this.selectedCategory = category;
        }
    }
});
</script>

<style scoped>
.v-toolbar-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.v-simple-table {
    margin: 0 16px 20px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    width: calc(100% - 32px);
}

/* Table header styles */
:deep(.v-simple-table > .v-table__wrapper > table > thead > tr > th) {
    background: linear-gradient(to bottom, #f5f7ff, #e8eaf6);
    color: #1a237e;
    font-weight: 600;
    padding: 12px 16px;
    font-size: 0.875rem;
    border-bottom: 2px solid #1a237e;
    white-space: nowrap;
}

/* Table body styles */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr > td) {
    padding: 12px 16px;
    font-size: 0.875rem;
    border-bottom: 1px solid #e8eaf6;
}

/* Zebra striping */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr:nth-child(even)) {
    background-color: #fafafa;
}

/* Hover effect */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr:hover) {
    background-color: rgba(26, 35, 126, 0.04);
}

/* Metrics container styles */
.metrics-container {
    padding: 16px;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.metrics-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: #1a237e;
    margin-bottom: 16px;
    padding-left: 8px;
    border-left: 4px solid #1a237e;
}

/* Select field styles */
:deep(.v-select) {
    margin-bottom: 16px;
}

:deep(.v-select__slot) {
    border-color: #1a237e;
}

:deep(.v-select__selection) {
    color: #1a237e;
}
</style>
