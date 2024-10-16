<template>
  <v-app>
    <v-main>
      <MainComponent/>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import MainComponent from './components/MainComponent.vue'

export default defineComponent({
  name: 'App',

  components: {
    MainComponent,
  },

  data () {
    return {
      //
    }
  },
})
</script>
