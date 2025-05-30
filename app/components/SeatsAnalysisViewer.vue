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
<script lang="ts">
  import { defineComponent, ref, watchEffect, onMounted, computed } from 'vue';
  import { useRoute } from 'vue-router';
  import type { Seat } from '@/model/Seat';

  export default defineComponent({
    name: 'SeatsAnalysisViewer',
    props: {
      seats: {
        type: Array as () => Seat[],
        required: true,
        default: () => []
      },
      teams: {
        type: Array as () => string[], // Array of selected team slugs
        required: false,
        default: () => []
      }
    },
    setup(props) {
      const totalSeats = ref<Seat[]>([]);
      const noshowSeats = ref<number>(0);
      const unusedSeatsInSevenDays = ref<number>(0);
      const unusedSeatsInThirtyDays = ref<number>(0);
      const unusedSeatsInSixtyDays = ref<number>(0);
      
      // Add new reactive ref to store team members
      const teamMembers = ref<string[]>([]);

      // Log environment information
      if (process.client) {
        console.log('SeatsAnalysisViewer is running on the client.');
      } else if (process.server) {
        console.log('SeatsAnalysisViewer is running on the server.');
      }

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
        noshowSeats,
        unusedSeatsInSevenDays,
        unusedSeatsInThirtyDays,
        unusedSeatsInSixtyDays,
        teamMembers, // Export teamMembers to use in the component
      };
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
        selectedCategory: 'totalAssigned', // Track selected category
        filteredSeats: [] as Seat[], // Filtered seats based on team and category
        // Removed redundant declaration of teamMembers to avoid state conflicts
      };
    },
    computed: {
      // Add computed property for team filtered seats
      // Generated by Zhuang
      teamFilteredSeats(): Seat[] {
        // If no team members, return all seats
        if (this.teamMembers.length === 0) {
          return this.totalSeats;
        }
        
        // Filter seats by team member logins
        return this.totalSeats.filter(seat => 
          this.teamMembers.includes(seat.login)
        );
      },
      
      // Add computed properties for filtered metric counts
      teamFilteredNoshowSeats(): number {
        return this.teamFilteredSeats.filter(seat => seat.last_activity_at === null).length;
      },
      
      teamFilteredUnusedSeatsInSevenDays(): number {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return this.teamFilteredSeats.filter(seat => 
          seat.last_activity_at && new Date(seat.last_activity_at) < oneWeekAgo
        ).length;
      },
      
      teamFilteredUnusedSeatsInThirtyDays(): number {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return this.teamFilteredSeats.filter(seat => 
          seat.last_activity_at && new Date(seat.last_activity_at) < thirtyDaysAgo
        ).length;
      },
      
      teamFilteredUnusedSeatsInSixtyDays(): number {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        return this.teamFilteredSeats.filter(seat => 
          seat.last_activity_at && new Date(seat.last_activity_at) < sixtyDaysAgo
        ).length;
      },
      
      // This computes the seats to display based on both team filter and category filter
      // Generated by Zhuang
      filteredSeatsByCategory() {
        const seats = this.teamFilteredSeats;
        
        // Apply category filter
        switch (this.selectedCategory) {
          case 'assignedButNeverUsed':
            return seats.filter(seat => seat.last_activity_at === null);
            
          case 'noActivity7Days':
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return seats.filter(seat => 
              seat.last_activity_at && new Date(seat.last_activity_at) < oneWeekAgo
            );
            
          case 'noActivity30Days':
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return seats.filter(seat => 
              seat.last_activity_at && new Date(seat.last_activity_at) < thirtyDaysAgo
            );
            
          case 'noActivity60Days':
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            return seats.filter(seat => 
              seat.last_activity_at && new Date(seat.last_activity_at) < sixtyDaysAgo
            );
            
          case 'totalAssigned':
          default:
            return seats;
        }
      }
    },
    methods: {      async fetchTeamMembers() {
        try {
          const config = this.$config.public;
          const route = useRoute();
          
          // 首先尝试从URL路由参数获取当前组织，如果不存在则使用配置
          const currentOrg = (route.params.org as string) || config.githubOrg;
          
          // 获取当前团队，首先检查传入的teams，然后是路由参数，最后是配置
          const currentTeam = this.teams.length > 0 
            ? this.teams[0] // Just take the first team if there are any
            : (route.params.team as string || config.githubTeam || '');

          console.log('Team to fetch members for:', currentTeam);
          console.log('Using organization:', currentOrg);

          if (currentTeam) {
            // Ensure team is a string
            const teamName = String(currentTeam);
            
            console.log('Processing team:', teamName);
            
            // Pass the team name directly as the $fetch utility will handle URL encoding
            console.log('Team name:', teamName);
            
            const response = await $fetch('/api/teams', {
              method: 'GET',
              params: {
                action: 'getTeamMembersByName',
                teamName: teamName,
                organization: currentOrg
              }
            });

            if (Array.isArray(response)) {
              this.teamMembers = response.map((member: any) => member.login);
              console.log('Fetched team members:', this.teamMembers);
            } else {
              console.warn(`Invalid response for team ${teamName}:`, response);
              this.teamMembers = [];
            }
          } else {
            console.warn('No team provided for fetching members.');
            this.teamMembers = [];
          }
        } catch (error) {
          console.error('Error fetching team members:', error);
          this.teamMembers = [];
        }
      },
      async updateFilteredSeats() {
        console.log('Updating filtered seats...');
        await this.fetchTeamMembers();
        
        // Apply both team and category filtering
        this.filteredSeats = this.filteredSeatsByCategory;
        
        console.log('Filtered seats updated:', this.filteredSeats);
      },
      selectCategory(category: string) {
        console.log('Category selected:', category);
        this.selectedCategory = category;
        this.updateFilteredSeats(); // Update filtered seats when category changes
      }
    },
    watch: {
      teams: {
        handler: 'updateFilteredSeats',
        immediate: true
      },
      
      // Add watcher for selectedCategory
      selectedCategory: {
        handler: 'updateFilteredSeats',
        immediate: true
      }
    },
    mounted() {
      console.log('SeatsAnalysisViewer component mounted.');
      this.updateFilteredSeats(); // Initial filtering on mount
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

/* Add new style for selected card */
.selected-card {
  border: 2px solid #1a237e !important;
  box-shadow: 0 4px 8px rgba(26, 35, 126, 0.2) !important;
  transform: translateY(-2px);
  transition: all 0.3s ease;
}
</style>
