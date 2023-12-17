<template>
    <div class="appHeader">
      <img src="/assets/copilotLogo.png" alt="Copilot Logo"  width="100px" height="100px"/>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    name: 'AppHeader'
  });
  </script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
  <style scoped>
  .header {
    display: flex;
    justify-content: space-between;
    padding: 20px;
  }
  </style>