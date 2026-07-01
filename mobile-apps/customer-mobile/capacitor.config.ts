import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nextou.customer',
  appName: 'Nextou',
  webDir: '../../dist/customer-app/browser',
  bundledWebRuntime: false,
  server: {
    hostname: 'nex-connect.in',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'nex-connect.in',
      'www.nex-connect.in',
      'maps.googleapis.com',
      'maps.gstatic.com',
      'places.googleapis.com',
      'routes.googleapis.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'www.google.com',
      'google.com',
      'maps.google.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2600,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#2C2976',
      androidSplashResourceName: 'splash_logo',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#FF7A21',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#2C2976',
    },
    Keyboard: {
      resize: 'body',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
