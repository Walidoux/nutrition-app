import type { CapacitorConfig } from '@capacitor/cli'

const liveUrl = process.env.CAPACITOR_LIVE_URL

const config: CapacitorConfig = {
  appId: 'com.yourname.myapp',
  appName: 'MyApp',
  webDir: 'dist',
  server: liveUrl
    ? {
        url: liveUrl,
        cleartext: true
      }
    : undefined
}

export default config
