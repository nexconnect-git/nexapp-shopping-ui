import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexconnect.customer',
  appName: 'NexConnect',
  webDir: '../dist/customer-app/browser',
  server: {
    androidScheme: 'https',
    cleartext: true   // allow HTTP to local dev server; remove for production HTTPS
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6b33ee',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6b33ee',
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
