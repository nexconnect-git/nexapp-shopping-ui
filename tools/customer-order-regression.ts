import '@angular/compiler';
import { strict as assert } from 'node:assert';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TestBed, TestComponentRenderer } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { Subject } from 'rxjs';
import { AuthService } from '@shared/lib/services/auth.service';
import { OrderService } from '../projects/customer-app/src/app/services/order.service';
import { CustomerOrderApiService } from '../projects/customer-app/src/app/services/customer-order-api.service';
import { AppStateService } from '../projects/customer-app/src/app/services/app-state.service';
import { UiService } from '../projects/customer-app/src/app/services/ui.service';

// Isolated response-order tests of the real service. These providers never enter production.
TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
const listRequests: Subject<any>[] = [];
const detailRequests: Subject<any>[] = [];
const api = {
  getOrders: () => { const request = new Subject<any>(); listRequests.push(request); return request; },
  getOrder: () => { const request = new Subject<any>(); detailRequests.push(request); return request; },
};
const auth = { sessionVersion: 0, user: signal({ id: 'qa-customer' }), isLoggedIn: () => true };
TestBed.configureTestingModule({ providers: [
  provideZonelessChangeDetection(),
  { provide: DOCUMENT, useValue: {} },
  { provide: TestComponentRenderer, useValue: { removeAllRootElements() {} } },
  OrderService, { provide: CustomerOrderApiService, useValue: api },
  { provide: AuthService, useValue: auth },
  { provide: AppStateService, useValue: {} }, { provide: UiService, useValue: {} },
] });
const orders = TestBed.inject(OrderService);
TestBed.tick();
const raw = (id: string, status = 'picked_up') => ({
  id, order_number: 'QA-OWNED', status, total: '270', items: [],
  delivery_address: { full_name: 'Private QA recipient', address_line1: 'Private QA address' },
});
const seed = (id: string) => {
  orders.loadOrders();
  listRequests.at(-1)!.next({ results: [raw(id)], count: 1 });
  listRequests.at(-1)!.complete();
};
const detail = (id: string) => { orders.refreshOrder(id); return detailRequests.at(-1)!; };

seed('retained');
detail('retained').error({ status: 503 });
assert.equal(orders.getOrder('retained').id, 'retained', 'Transient failure must retain the last owned order');
assert.ok(orders.detailErrors()['retained'], 'Retained data must expose the refresh failure');
detail('retained').next(raw('retained', 'delivered'));
assert.equal(orders.getOrder('retained').raw?.status, 'delivered');
assert.equal(orders.detailErrors()['retained'], '');
console.log('PASS: transient refresh retains owned data; successful retry updates status and clears warning.');

for (const status of [401, 403, 404]) {
  const id = 'removed-' + status;
  seed(id);
  detail(id).error({ status });
  assert.equal(orders.getOrder(id).id, 'loading', `${status} must remove private cached details`);
  assert.equal(orders.orders().some(order => order.id === id), false);
  assert.ok(orders.detailErrors()[id], 'A denied/missing record must remain an error, not an empty success');
  console.log(`PASS: ${status} clears private detail and list cache while preserving an explicit error.`);
}

seed('session-order');
const oldRequest = detail('session-order');
auth.sessionVersion++;
auth.user.set({ id: 'next-qa-customer' });
TestBed.tick();
assert.equal(orders.orders().length, 0, 'Session change must clear old customer list');
seed('session-order');
oldRequest.error({ status: 403 });
assert.equal(orders.getOrder('session-order').id, 'session-order', 'Old-session failure must not delete current-session cache');
assert.equal(orders.detailErrors()['session-order'] || '', '');
console.log('PASS: late old-session denial cannot remove or taint the current session order.');
TestBed.resetTestingModule();
