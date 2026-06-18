export type NextouNativePermission = 'location' | 'background-location' | 'notifications' | 'camera';

export interface NextouNativeBridge {
  getLocation(): Promise<GeolocationPosition>;
  watchPosition(callbackName: string): Promise<string>;
  clearWatch(watchId: string): Promise<void>;
  requestPermission(type: NextouNativePermission): Promise<PermissionState | 'prompt'>;
  openDialer(phone: string): Promise<void>;
  openMaps(lat: number, lng: number, label?: string): Promise<void>;
  share(data: ShareData): Promise<void>;
  getDeviceInfo(): Promise<unknown>;
  getNetworkStatus(): Promise<unknown>;
}

declare global {
  interface Window {
    NextouNative?: NextouNativeBridge;
  }
}

export {};
