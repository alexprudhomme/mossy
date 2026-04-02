import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'Mossy',
    identifier: 'com.mossy.app',
    version: '1.0.0'
  },
  runtime: {
    exitOnLastWindowClosed: true
  },
  build: {
    mac: {
      icons: 'AppIcon.iconset',
      bundleCEF: false,
      codesign: false
    },
    linux: {
      bundleCEF: false
    },
    win: {
      bundleCEF: false
    },
    bun: {
      entrypoint: 'src/bun/index.ts'
    },
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets'
    },
    watchIgnore: ['dist/**']
  },
  release: {
    baseUrl: 'https://github.com/alexprudhomme/mossy/releases/latest/download'
  }
} satisfies ElectrobunConfig
