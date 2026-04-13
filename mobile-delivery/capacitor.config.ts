import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexconnect.delivery',
  appName: 'NexConnect Delivery',
  webDir: '../dist/delivery-app/browser',
  server: {
    androidScheme: 'https',
    cleartext: true   // allow HTTP to local dev server; remove for production HTTPS
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#059669',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#059669',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP'
    }
  },
  android: {
    allowMixedContent: true   // allow HTTP API calls during development
  }
};

export default config;
