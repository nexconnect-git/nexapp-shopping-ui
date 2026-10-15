import { Injectable } from '@angular/core';
import type { PaymentAdapter } from '@nexconnect/customer-api-client';

declare const Razorpay: any;

@Injectable({ providedIn: 'root' })
export class BrowserPaymentAdapter
  implements PaymentAdapter<Record<string, any>, any>
{
  async open(
    payment: Record<string, any>,
    description: string,
    user?: unknown,
    onStage?: (stage: string) => void
  ): Promise<any> {
    try {
      await this.loadRazorpayScript();
    } catch (error) {
      throw Object.assign(
        new Error('Secure payment could not load. Nothing has been charged.'),
        { code: 'provider_script_unavailable' }
      );
    }
    return new Promise((resolve, reject) => {
      const checkout = new Razorpay({
        key: payment['key_id'] || payment['razorpay_key_id'] || '',
        amount: payment['amount'],
        currency: payment['currency'],
        name: 'Nextou',
        description,
        order_id: payment['razorpay_order_id'],
        handler: resolve,
        modal: {
          ondismiss: () =>
            reject(
              Object.assign(
                new Error('Payment was cancelled. Nothing was confirmed.'),
                { code: 'provider_cancelled' }
              )
            ),
        },
        theme: { color: '#5740cf' },
      });
      checkout.on('payment.failed', (response: any) => {
        reject(
          Object.assign(
            new Error(
              response?.error?.description ||
                'The payment provider reported a failed payment.'
            ),
            { code: 'provider_failed' }
          )
        );
        checkout.close();
      });
      onStage?.('provider-open');
      checkout.open();
    });
  }

  private loadRazorpayScript(): Promise<void> {
    if (typeof Razorpay !== 'undefined') return Promise.resolve();
    if (typeof document === 'undefined')
      return Promise.reject(
        new Error('Online payment is not available in this browser session.')
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
            existing.remove();
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
      const timer = window.setTimeout(() => {
        script.remove();
        reject(new Error('Could not load Razorpay checkout.'));
      }, 10000);
      script.onload = () => {
        window.clearTimeout(timer);
        if (typeof Razorpay !== 'undefined') resolve();
        else {
          script.remove();
          reject(new Error('Could not load Razorpay checkout.'));
        }
      };
      script.onerror = () => {
        window.clearTimeout(timer);
        script.remove();
        reject(new Error('Could not load Razorpay checkout.'));
      };
      document.head.appendChild(script);
    });
  }
}
