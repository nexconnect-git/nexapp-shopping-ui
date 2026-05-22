import { Injectable } from '@angular/core';
import type { PaymentAdapter } from '@nexconnect/customer-api-client';

declare const Razorpay: any;

@Injectable({ providedIn: 'root' })
export class BrowserPaymentAdapter implements PaymentAdapter<
  Record<string, any>,
  any
> {
  async open(
    payment: Record<string, any>,
    description: string,
    user?: unknown,
  ): Promise<any> {
    await this.loadRazorpayScript();
    return new Promise((resolve, reject) => {
      const checkout = new Razorpay({
        key: payment['key_id'] || payment['razorpay_key_id'] || '',
        amount: payment['amount'],
        currency: payment['currency'],
        name: 'FlashDrop',
        description,
        order_id: payment['razorpay_order_id'],
        handler: resolve,
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        theme: { color: '#13a35b' },
      });
      checkout.open();
    });
  }

  private loadRazorpayScript(): Promise<void> {
    if (typeof Razorpay !== 'undefined') return Promise.resolve();
    if (typeof document === 'undefined')
      return Promise.reject(
        new Error('Online payment is not available in this browser session.'),
      );
    const existing = document.getElementById('razorpay-checkout-js');
    if (existing) {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (typeof Razorpay !== 'undefined') {
            window.clearInterval(timer);
            resolve();
          } else if (Date.now() - startedAt > 10000) {
            window.clearInterval(timer);
            reject(new Error('Could not load Razorpay checkout.'));
          }
        }, 80);
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Could not load Razorpay checkout.'));
      document.head.appendChild(script);
    });
  }
}
