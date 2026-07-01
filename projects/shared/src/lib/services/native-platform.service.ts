import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export type NativeWatchId = number | string;

@Injectable({ providedIn: 'root' })
export class NativePlatformService {
  private pushRegistration?: Promise<{ token: string; platform: string } | null>;

  isNative(): boolean {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform();
  }

  getPlatform(): string {
    return Capacitor.getPlatform();
  }

  async requestLocationPermissions(): Promise<boolean> {
    if (!this.isNative()) return true;

    const { Geolocation } = await import('@capacitor/geolocation');
    let permissions = await Geolocation.checkPermissions();
    if (
      permissions.location !== 'granted' &&
      permissions.coarseLocation !== 'granted'
    ) {
      permissions = await Geolocation.requestPermissions();
    }
    return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
  }

  async getCurrentPosition(options: PositionOptions = {}): Promise<GeolocationPosition> {
    if (this.isNative()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const hasPermission = await this.requestLocationPermissions();
      if (!hasPermission) {
        throw new Error('Location permission was denied');
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      });
      return position as unknown as GeolocationPosition;
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  async watchPosition(
    options: PositionOptions,
    onPosition: (position: GeolocationPosition) => void,
    onError: (error: GeolocationPositionError | Error) => void,
  ): Promise<NativeWatchId> {
    if (this.isNative()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const hasPermission = await this.requestLocationPermissions();
      if (!hasPermission) {
        throw new Error('Location permission was denied');
      }
      return Geolocation.watchPosition(
        {
          enableHighAccuracy: options.enableHighAccuracy,
          timeout: options.timeout,
          maximumAge: options.maximumAge,
        },
        (position, error) => {
          if (error) {
            onError(error);
            return;
          }
          if (position) onPosition(position as unknown as GeolocationPosition);
        },
      );
    }

    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    return navigator.geolocation.watchPosition(onPosition, onError, options);
  }

  async clearWatch(watchId: NativeWatchId): Promise<void> {
    if (this.isNative()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.clearWatch({ id: String(watchId) });
      return;
    }

    navigator.geolocation.clearWatch(Number(watchId));
  }

  async registerForPushNotifications(): Promise<{ token: string; platform: string } | null> {
    if (!this.isNative()) return null;
    if (this.pushRegistration) return this.pushRegistration;

    this.pushRegistration = this.createPushRegistration().catch((error) => {
      console.warn('[Native] Push notifications unavailable.', error);
      return null;
    });
    return this.pushRegistration;
  }

  async hideSplashScreen(): Promise<void> {
    if (!this.isNative()) return;

    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  }

  private async createPushRegistration(): Promise<{ token: string; platform: string } | null> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      let permissions = await PushNotifications.checkPermissions();

      if (permissions.receive === 'prompt') {
        permissions = await PushNotifications.requestPermissions();
      }

      if (permissions.receive !== 'granted') {
        return null;
      }

      let settled = false;
      let registrationHandle: { remove: () => Promise<void> } | null = null;
      let errorHandle: { remove: () => Promise<void> } | null = null;
      let resolveRegistration: (result: { token: string; platform: string } | null) => void =
        () => {};

      const registration = new Promise<{ token: string; platform: string } | null>(
        (resolve) => {
          resolveRegistration = resolve;
        },
      );

      const settle = (result: { token: string; platform: string } | null) => {
        if (settled) return;
        settled = true;
        void registrationHandle?.remove();
        void errorHandle?.remove();
        resolveRegistration(result);
      };

      registrationHandle = await PushNotifications.addListener('registration', (token) =>
        settle({ token: token.value, platform: this.getPlatform() }),
      );
      errorHandle = await PushNotifications.addListener('registrationError', () =>
        settle(null),
      );

      await PushNotifications.register();
      window.setTimeout(() => settle(null), 10000);
      return registration;
    } catch (error) {
      console.warn('[Native] Push notification registration failed.', error);
      return null;
    }
  }
}
