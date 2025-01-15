const { defineConfig } = require('@vue/cli-service')
const version =  require('./package.json').version;

process.env.VUE_APP_VERSION = version;

module.exports = defineConfig({
  transpileDependencies: true,

  pluginOptions: {
    vuetify: {
			// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
		}
  }
})
