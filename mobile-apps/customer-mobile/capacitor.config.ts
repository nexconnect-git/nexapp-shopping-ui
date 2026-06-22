import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nextou.customer',
  appName: 'Nextou',
  webDir: 'src',
  bundledWebRuntime: false,
  server: {
    url: 'https://www.nex-connect.in/sa/',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'www.nex-connect.in',
      'nex-connect.in',
      'maps.googleapis.com',
      'maps.gstatic.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'www.google.com',
      'google.com',
    ],
    errorPath: 'offline.html',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2600,
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: '#38268E',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#FF7A21',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#38268E',
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
