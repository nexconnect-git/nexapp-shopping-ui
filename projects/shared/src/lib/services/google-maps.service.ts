import { Injectable } from '@angular/core';
import {
  computeGoogleRoute,
  getGoogleMapsMapId,
  getGoogleMapsApiKey,
  GoogleLatLng,
  GoogleRouteResult,
} from '../utils/google-api';

declare const google: any;

declare global {
  interface Window {
    __nexconnectGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  private scriptPromise: Promise<void> | null = null;
  private missingApiKeyWarned = false;
  private authFailureHandlerInstalled = false;
  private authFailed = false;

  apiKey(fallback = ''): string {
    return getGoogleMapsApiKey(fallback);
  }

  mapId(fallback = ''): string {
    return getGoogleMapsMapId(fallback);
  }

  hasApiKey(fallback = ''): boolean {
    return !!this.apiKey(fallback);
  }

  hasRuntime(): boolean {
    return (
      typeof google !== 'undefined' &&
      !!google?.maps &&
      (typeof google.maps.importLibrary === 'function' ||
        typeof google.maps.Map === 'function')
    );
  }

  loadJavaScriptApi(apiKey = this.apiKey()): Promise<void> {
    this.installAuthFailureHandler();
    if (this.authFailed) {
      return Promise.reject(new Error('Google Maps JavaScript API authorization failed'));
    }
    if (this.hasRuntime()) return Promise.resolve();
    if (!apiKey) {
      if (!this.missingApiKeyWarned) {
        this.missingApiKeyWarned = true;
        console.warn(
          '[Maps] Google Maps API key is missing. Configure window.__NEXCONNECT_CONFIG__.googleMapsApiKey (runtime-config.js) or app environment fallback for local development.',
        );
      }
      return Promise.reject(new Error('Google Maps API key is not configured'));
    }
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(
        'google-maps-js',
      ) as HTMLScriptElement | null;
      const authFailureEvent = 'nexconnect:google-maps-auth-failure';
      const fail = (error = new Error('Google Maps JavaScript API could not be loaded')) => {
        window.removeEventListener(authFailureEvent, failOnAuthFailure);
        this.scriptPromise = null;
        reject(error);
      };
      const failOnAuthFailure = () => {
        fail(new Error('Google Maps JavaScript API authorization failed'));
      };
      const finish = () => {
        window.removeEventListener(authFailureEvent, failOnAuthFailure);
        if (this.authFailed) {
          fail(new Error('Google Maps JavaScript API authorization failed'));
          return;
        }
        if (this.hasRuntime()) {
          resolve();
        } else {
          fail();
        }
      };

      window.addEventListener(authFailureEvent, failOnAuthFailure, {
        once: true,
      });

      window.__nexconnectGoogleMapsReady = finish;

      if (existing) {
        const poll = window.setInterval(() => {
          if (this.hasRuntime()) {
            window.clearInterval(poll);
            resolve();
          }
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(poll);
          finish();
        }, 10000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.src = [
        'https://maps.googleapis.com/maps/api/js',
        `?key=${encodeURIComponent(apiKey)}`,
        '&v=weekly',
        '&loading=async',
        '&callback=__nexconnectGoogleMapsReady',
      ].join('');
      script.async = true;
      script.defer = true;
      script.onerror = () => fail();
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }

  private installAuthFailureHandler() {
    if (this.authFailureHandlerInstalled || typeof window === 'undefined') {
      return;
    }

    this.authFailureHandlerInstalled = true;
    const previousHandler = window.gm_authFailure;

    window.gm_authFailure = () => {
      this.authFailed = true;
      window.dispatchEvent(new CustomEvent('nexconnect:google-maps-auth-failure'));
      previousHandler?.();
    };
  }

  computeRoute(
    origin: GoogleLatLng,
    destination: GoogleLatLng,
    intermediates: GoogleLatLng[] = [],
    apiKey = this.apiKey(),
  ): Promise<GoogleRouteResult | null> {
    return computeGoogleRoute(apiKey, origin, destination, intermediates);
  }
}
