<template>
    <div class="tiles-container">      
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div class="tiles-text">
                    <div class="spacing-25"></div>
                    <div class="text-h6 mb-1">Cumulative Number of Turns</div>
                    <div class="text-caption">Over the last 28 days</div>
                    <p class="text-h4">{{ cumulativeNumberTurns }}</p>
                </div>
            </v-card-item>
        </v-card>

        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div class="tiles-text">
                    <div class="spacing-10"></div>
                    <div class="text-h6 mb-1">Cumulative Number of Acceptances</div>
                    <div class="text-caption">Over the last 28 days</div>
                    <p class="text-h4">{{ cumulativeNumberAcceptances }}</p>
                </div>
            </v-card-item>
        </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2">

            <h2>Total Acceptances | Total Turns Count</h2>
            <Line :data="totalNumberAcceptancesAndTurnsChartData" :options="chartOptions" />

            <h2>Total Active Copilot Chat Users</h2>
            <Bar :data="totalActiveCopilotChatUsersChartData" :options="totalActiveChatUsersChartOptions" />

        </v-container>
    </v-main>
</template>
  
<script lang="ts">
  import { defineComponent, ref, toRef } from 'vue';
  import { Metrics } from '../model/Metrics';
  import { Line, Bar } from 'vue-chartjs'
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
name: 'CopilotChatViewer',
props: {
        metrics: {
            type: Object,
            required: true
        }
    },
components: {
Bar,
Line
},
setup(props) {

    let cumulativeNumberAcceptances = ref(0);

    let cumulativeNumberTurns = ref(0);

    //Total Copilot Chat Active Users
    const totalActiveCopilotChatUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

    const totalActiveChatUsersChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
        y: {
        beginAtZero: true,
        ticks: {
            stepSize: 1
        }
        }
    },
    layout: {
        padding: {
        left: 50,
        right: 50,
        top: 50,
        bottom: 50
        }
    },
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        height: 300,
        width: 300,
        layout: {
            padding: {
            left: 150,
            right: 150,
            top: 20,
            bottom: 40
            }
        },
    };

    //Total Number Acceptances And Turns
    const totalNumberAcceptancesAndTurnsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const data = toRef(props, 'metrics').value;

    cumulativeNumberTurns.value = 0;
    const cumulativeNumberTurnsData = data.map((m: Metrics)  => {        
        cumulativeNumberTurns.value += m.total_chat_turns;
        return m.total_chat_turns;
    });

    cumulativeNumberAcceptances.value = 0;
    const cumulativeNumberAcceptancesData = data.map((m: Metrics)  => {        
        cumulativeNumberAcceptances.value += m.total_chat_acceptances;
        return m.total_chat_acceptances;
    });

    totalNumberAcceptancesAndTurnsChartData.value = {
    labels: data.map((m: Metrics)  => m.day),
        datasets: [
        {
            label: 'Total Acceptances',
            data: cumulativeNumberAcceptancesData,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)'

        },
        {
            label: 'Total Turns',
            data: cumulativeNumberTurnsData,
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)'
        }]
    };

    totalActiveCopilotChatUsersChartData.value = {
        labels: data.map((m: Metrics) => m.day),
        datasets: [
        {
            label: 'Total Active Copilot Chat Users',
            data: data.map((m: Metrics) => m.total_active_chat_users),
            backgroundColor: 'rgba(0, 0, 139, 0.2)', // dark blue with 20% opacity
            borderColor: 'rgba(255, 99, 132, 1)'
        }]
    };
    
    return {  totalActiveCopilotChatUsersChartData, totalActiveChatUsersChartOptions,cumulativeNumberAcceptances, cumulativeNumberTurns, totalNumberAcceptancesAndTurnsChartData, chartOptions};
}
});

</script>
