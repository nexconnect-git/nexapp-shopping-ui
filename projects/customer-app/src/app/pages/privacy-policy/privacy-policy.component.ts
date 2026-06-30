import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type PolicySection = {
  icon: string;
  title: string;
  body: string;
  items: string[];
};

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
})
export class PrivacyPolicyComponent {
  readonly lastUpdated = '30 June 2026';

  readonly summaryCards = [
    {
      icon: 'person',
      label: 'Account',
      text: 'Name, phone number, email, OTP login state, and profile updates.',
    },
    {
      icon: 'location_on',
      label: 'Delivery',
      text: 'Saved addresses, selected delivery area, coordinates, serviceability, and ETA checks.',
    },
    {
      icon: 'shopping_bag',
      label: 'Shopping',
      text: 'Cart, coupons, checkout preview, orders, invoices, reorder, ratings, and support context.',
    },
    {
      icon: 'notifications',
      label: 'Updates',
      text: 'Order alerts, notification status, device token when notifications are enabled, and toast messages.',
    },
  ];

  readonly sections: PolicySection[] = [
    {
      icon: 'inventory_2',
      title: 'Information We Collect',
      body: 'Nextou collects only the customer information needed to run shopping, delivery, account, and support features in the customer app.',
      items: [
        'Account details such as name, phone number, email address, OTP login events, and profile edits.',
        'Delivery details such as saved addresses, receiver phone number, pinned map location, latitude, longitude, city, state, postal code, and selected delivery area.',
        'Shopping details such as products viewed, cart items, quantities, coupons, delivery fee previews, slot selections, payment method selection, and checkout validation.',
        'Order details such as order history, active order status, delivery tracking, invoices, reorder actions, cancellation requests, ratings, and issue/support context.',
        'App state stored on your device, including access tokens, refresh tokens, user profile cache, guest cart, recent searches, selected location, country, and currency settings.',
      ],
    },
    {
      icon: 'task_alt',
      title: 'How We Use Information',
      body: 'We use customer information to make the instant-delivery experience work reliably and to reduce repeated entry during checkout.',
      items: [
        'Authenticate you with OTP and keep your customer session active.',
        'Show serviceable stores, delivery availability, ETA, distance, taxes, fees, coupons, and checkout previews for your selected location.',
        'Create, update, track, cancel, rate, reorder, and invoice orders.',
        'Maintain cart quantity, store-lock, fulfillment, coupon, delivery slot, and payment selection behavior.',
        'Send order, account, support, and promotional notifications where supported by your device and app settings.',
        'Improve app quality by using operational signals such as failed API calls, loading states, serviceability conflicts, and validation errors.',
      ],
    },
    {
      icon: 'share',
      title: 'When Information Is Shared',
      body: 'Customer information is shared only with the platform services and partners needed to complete the requested flow.',
      items: [
        'Stores receive order and fulfillment information needed to prepare items.',
        'Delivery partners may receive delivery address, order status, and contact context needed to complete delivery.',
        'Payment providers may process payment setup or payment confirmation; sensitive payment credentials are handled by the payment provider or checkout flow.',
        'Map and location providers may process search, geocoding, or map pin information when you use location search or map selection.',
        'Support, invoice, notification, and platform administration services may access records needed to resolve issues, generate receipts, or keep the service safe.',
      ],
    },
    {
      icon: 'security',
      title: 'Storage And Security',
      body: 'The app uses authenticated APIs and local browser/device storage to keep the shopping session fast.',
      items: [
        'Access tokens, refresh tokens, and cached user data are stored in browser or device storage so you do not need to login on every page.',
        'Guest cart and selected location may be stored locally before login.',
        'You should use a trusted device and logout on shared devices to clear the customer session.',
        'No online system can be guaranteed completely secure, but the app limits client storage to data needed for login, cart, location, and app continuity.',
      ],
    },
    {
      icon: 'manage_accounts',
      title: 'Your Choices',
      body: 'You can manage several data points directly from the customer app.',
      items: [
        'Update your profile from Account > Edit profile.',
        'Add, edit, select, or remove delivery addresses from Addresses.',
        'Change your selected delivery area from the location picker.',
        'Clear cart items from Cart and adjust quantities from product cards or checkout.',
        'Logout from Account to end the local session on that device.',
        'Contact support through order and account flows for privacy, correction, deletion, invoice, or order-history questions.',
      ],
    },
    {
      icon: 'child_care',
      title: 'Children And Restricted Items',
      body: 'Nextou is intended for customers who can lawfully place orders in their location.',
      items: [
        'The app is not designed for children to independently create accounts or place orders.',
        'Some products may be marked age-restricted, unavailable, non-returnable, or subject to store-specific handling rules.',
        'Stores and delivery partners may need to verify eligibility or availability before fulfilling certain orders.',
      ],
    },
  ];
}
