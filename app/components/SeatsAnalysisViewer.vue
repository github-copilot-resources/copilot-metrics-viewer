<template>
    <div class="tiles-container">
        <v-card elevation="4" color="white" 
            :class="['mx-auto', 'my-4', {'selected-card': selectedCategory === 'totalAssigned'}]" 
            style="width: 330px; height: 175px;" 
            @click="selectCategory('totalAssigned')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">Total Assigned  </div>
                    <div class="text-caption">
                        Currently assigned seats
                    </div>
                    <!-- Change to use teamFilteredSeats instead of totalSeats -->
                    <p class="text-h4">{{ teamFilteredSeats.length }}</p>
                </div>
            </v-card-item>
        </v-card>

        <v-card elevation="4" color="white" 
            :class="['mx-auto', 'my-3', {'selected-card': selectedCategory === 'assignedButNeverUsed'}]" 
            style="width: 300px; height: 175px;" 
            @click="selectCategory('assignedButNeverUsed')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">Assigned But Never Used</div>
                    <div class="text-caption">
                        No show seats
                    </div>
                    <!-- Change to use teamFilteredNoshowSeats instead of noshowSeats -->
                    <p class="text-h4">{{ teamFilteredNoshowSeats }}</p>
                </div>
            </v-card-item>
        </v-card>
        <v-card elevation="4" color="white" 
            :class="['mx-auto', 'my-4', {'selected-card': selectedCategory === 'noActivity7Days'}]" 
            style="width: 330px; height: 175px;" 
            @click="selectCategory('noActivity7Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 7 days </div>
                    <div class="text-caption">
                        No use in the last 7 days
                    </div>
                    <!-- Change to use teamFilteredUnusedSeatsInSevenDays -->
                    <p class="text-h4">{{ teamFilteredUnusedSeatsInSevenDays }}</p>
                </div>
            </v-card-item>
        </v-card>
        <v-card elevation="4" color="white" 
            :class="['mx-auto', 'my-4', {'selected-card': selectedCategory === 'noActivity30Days'}]" 
            style="width: 330px; height: 175px;" 
            @click="selectCategory('noActivity30Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 30 days </div>
                    <div class="text-caption">
                        No use in the last 30 days
                    </div>
                    <!-- Change to use teamFilteredUnusedSeatsInThirtyDays -->
                    <p class="text-h4">{{ teamFilteredUnusedSeatsInThirtyDays }}</p>
                </div>
            </v-card-item>
        </v-card>
        <v-card elevation="4" color="white" 
            :class="['mx-auto', 'my-4', {'selected-card': selectedCategory === 'noActivity60Days'}]" 
            style="width: 330px; height: 175px;" 
            @click="selectCategory('noActivity60Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 60 days </div>
                    <div class="text-caption">
                        No use in the last 60 days
                    </div>
                    <!-- Change to use teamFilteredUnusedSeatsInSixtyDays -->
                    <p class="text-h4">{{ teamFilteredUnusedSeatsInSixtyDays }}</p>
                </div>
            </v-card-item>
        </v-card>

        <!-- comment the new card for 15 days and 10 days as it is not must now.-->
        <!-- New card for 15 days inactive users -->
         <!--
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('noActivity15Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 15 days </div>
                    <div class="text-caption">
                        No use in the last 15 days
                    </div>
                    <p class="text-h4">{{ unusedSeatsInFifteenDays }}</p>
                </div>
            </v-card-item>
        </v-card>
        -->
        <!-- New card for 10 days inactive users -->
        <!--
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4"
            style="width: 330px; height: 175px;" @click="selectCategory('noActivity10Days')">
            <v-card-item class="d-flex justify-center align-center">
                <div class="tiles-text">
                    <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                    <div class="text-h6 mb-1">No Activity in the Last 10 days </div>
                    <div class="text-caption">
                        No use in the last 10 days
                    </div>
                    <p class="text-h4">{{ unusedSeatsInTenDays }}</p>
                </div>
            </v-card-item>
        </v-card>
        -->
    </div>
    
    <div>
        <v-main class="p-1" style="min-height: 300px;">
            <v-container style="min-height: 300px;" class="px-4 elevation-2">
                <br>
                <h2>
                  {{ 
                    selectedCategory === 'totalAssigned' ? 'All assigned seats' :
                    selectedCategory === 'assignedButNeverUsed' ? 'Seats assigned but never used' :
                    selectedCategory === 'noActivity7Days' ? 'Seats with no activity in the last 7 days' :
                    selectedCategory === 'noActivity30Days' ? 'Seats with no activity in the last 30 days' :
                    selectedCategory === 'noActivity60Days' ? 'Seats with no activity in the last 60 days' :
                    'All assigned seats'
                  }}
                </h2>
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
<script setup lang="ts">
import type { Seat } from '@/model/Seat';

// Define props interface
interface Props {
  seats: Seat[];
  teams?: string[]; // Array of selected team slugs
}

const props = withDefaults(defineProps<Props>(), {
  seats: () => [],
  teams: () => []
});

// Generated by Zhuang - Reactive data setup
const totalSeats = ref<Seat[]>([]);
const noshowSeats = ref<number>(0);
const unusedSeatsInSevenDays = ref<number>(0);
const unusedSeatsInThirtyDays = ref<number>(0);
const unusedSeatsInSixtyDays = ref<number>(0);
const teamMembers = ref<string[]>([]);
const selectedCategory = ref<string>('totalAssigned');
const filteredSeats = ref<Seat[]>([]);

// Table headers configuration
const headers = [
  { title: 'S.No', key: 'serialNumber' },
  { title: 'Login', key: 'login' },
  { title: 'GitHub ID', key: 'id' },
  { title: 'Assigning team', key: 'team' },
  { title: 'Assigned time', key: 'created_at' },
  { title: 'Last Activity At', key: 'last_activity_at' },
  { title: 'Last Activity Editor', key: 'last_activity_editor' },
];

// Log environment information for debugging
if (process.client) {
  console.log('SeatsAnalysisViewer is running on the client.');
} else if (process.server) {
  console.log('SeatsAnalysisViewer is running on the server.');
}

// Computed properties for team-filtered data
// Generated by Zhuang
const teamFilteredSeats = computed<Seat[]>(() => {
  // If no team members, return all seats
  if (teamMembers.value.length === 0) {
    return totalSeats.value;
  }
  
  // Filter seats by team member logins
  return totalSeats.value.filter((seat: Seat) => 
    teamMembers.value.includes(seat.login)
  );
});

const teamFilteredNoshowSeats = computed<number>(() => {
  return teamFilteredSeats.value.filter((seat: Seat) => seat.last_activity_at === null).length;
});

const teamFilteredUnusedSeatsInSevenDays = computed<number>(() => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return teamFilteredSeats.value.filter((seat: Seat) => 
    seat.last_activity_at && new Date(seat.last_activity_at) < oneWeekAgo
  ).length;
});

const teamFilteredUnusedSeatsInThirtyDays = computed<number>(() => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return teamFilteredSeats.value.filter((seat: Seat) => 
    seat.last_activity_at && new Date(seat.last_activity_at) < thirtyDaysAgo
  ).length;
});

const teamFilteredUnusedSeatsInSixtyDays = computed<number>(() => {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  return teamFilteredSeats.value.filter((seat: Seat) => 
    seat.last_activity_at && new Date(seat.last_activity_at) < sixtyDaysAgo
  ).length;
});

// This computes the seats to display based on both team filter and category filter
// Generated by Zhuang
const filteredSeatsByCategory = computed(() => {
  const seats = teamFilteredSeats.value;
  
  // Apply category filter
  switch (selectedCategory.value) {
    case 'assignedButNeverUsed':
      return seats.filter((seat: Seat) => seat.last_activity_at === null);
      
    case 'noActivity7Days':
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return seats.filter((seat: Seat) => 
        seat.last_activity_at && new Date(seat.last_activity_at) < oneWeekAgo
      );
      
    case 'noActivity30Days':
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return seats.filter((seat: Seat) => 
        seat.last_activity_at && new Date(seat.last_activity_at) < thirtyDaysAgo
      );
      
    case 'noActivity60Days':
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      return seats.filter((seat: Seat) => 
        seat.last_activity_at && new Date(seat.last_activity_at) < sixtyDaysAgo
      );
      
    case 'totalAssigned':
    default:
      return seats;
  }
});

// Generated by Zhuang - Methods for team member fetching and data filtering
const fetchTeamMembers = async () => {
  try {
    const config = useRuntimeConfig();
    const route = useRoute();
    
    // First try to get organization from URL route params, if not exists use config
    const currentOrg = (route.params.org as string) || config.public.githubOrg;
    
    // Get current team, check passed teams first, then route params, then config
    const currentTeam = props.teams.length > 0 
      ? props.teams[0] // Just take the first team if there are any
      : (route.params.team as string || config.public.githubTeam || '');

    console.log('Team to fetch members for:', currentTeam);
    console.log('Using organization:', currentOrg);

    if (currentTeam) {
      // Ensure team is a string
      const teamName = String(currentTeam);
      console.log('Processing team:', teamName);
      
      // Generated by Zhuang - Replace $fetch with useFetch for better SSR context sharing
      console.log('Team name:', teamName);
      
      const apiUrl = `/api/teams?action=getTeamMembersByName&teamName=${encodeURIComponent(teamName)}&organization=${encodeURIComponent(currentOrg)}`;
      const { data: response, error: teamMembersError } = await useFetch(apiUrl, {
        key: `team-members-${teamName}-${currentOrg}-${Date.now()}`,
        server: true,
        method: 'GET',
        default: () => []
      });

      if (teamMembersError.value) {
        console.error('Error fetching team members:', teamMembersError.value);
        teamMembers.value = [];
        return;
      }

      if (Array.isArray(response.value)) {
        teamMembers.value = response.value.map((member: any) => member.login);
        console.log('Fetched team members:', teamMembers.value);
      } else {
        console.warn(`Invalid response for team ${teamName}:`, response);
        teamMembers.value = [];
      }
    } else {
      console.warn('No team provided for fetching members.');
      teamMembers.value = [];
    }
  } catch (error) {
    console.error('Error fetching team members:', error);
    teamMembers.value = [];
  }
};

const updateFilteredSeats = async () => {
  console.log('Updating filtered seats...');
  await fetchTeamMembers();
  
  // Apply both team and category filtering
  filteredSeats.value = filteredSeatsByCategory.value;
  
  console.log('Filtered seats updated:', filteredSeats.value);
};

const selectCategory = (category: string) => {
  console.log('Category selected:', category);
  selectedCategory.value = category;
  updateFilteredSeats(); // Update filtered seats when category changes
};

// Watch for changes in props.seats and calculate metrics
watchEffect(() => {
  if (props.seats && Array.isArray(props.seats)) {
    totalSeats.value = props.seats;

    const oneWeekAgo = new Date();
    const thirtyDaysAgo = new Date();
    const sixtyDaysAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    let noshowCount = 0;
    let unusedIn7Count = 0;
    let unusedIn30Count = 0;
    let unusedIn60Count = 0;

    props.seats.forEach((seat: Seat) => {
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
        if (lastActivityDate < sixtyDaysAgo) {
          unusedIn60Count++;
        }
      }
    });

    // Sort totalSeats by last_activity_at
    totalSeats.value.sort((a: Seat, b: Seat) => {
      if (a.last_activity_at === null) {
        return -1;
      }
      if (b.last_activity_at === null) {
        return 1;
      }
      return new Date(a.last_activity_at) > new Date(b.last_activity_at) ? 1 : -1;
    });

    noshowSeats.value = noshowCount;
    unusedSeatsInSevenDays.value = unusedIn7Count;
    unusedSeatsInThirtyDays.value = unusedIn30Count;
    unusedSeatsInSixtyDays.value = unusedIn60Count;
  } else {
    throw new Error('Invalid number of seats');
  }
});

// Watch for changes in teams prop
watch(() => props.teams, () => {
  updateFilteredSeats();
}, { immediate: true });

// Watch for changes in selectedCategory
watch(selectedCategory, () => {
  updateFilteredSeats();
}, { immediate: true });

// Component mounted lifecycle
onMounted(() => {
  console.log('SeatsAnalysisViewer component mounted.');
  updateFilteredSeats(); // Initial filtering on mount
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

/* Add new style for selected card */
.selected-card {
  border: 2px solid #1a237e !important;
  box-shadow: 0 4px 8px rgba(26, 35, 126, 0.2) !important;
  transform: translateY(-2px);
  transition: all 0.3s ease;
}
</style>
