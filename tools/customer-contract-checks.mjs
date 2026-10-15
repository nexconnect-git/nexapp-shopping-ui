import assert from 'node:assert/strict';
import test from 'node:test';
import { handlingFeeForItems } from '../../packages/customer-core/dist/index.js';
import { CustomerApiError, createCustomerApiClient } from '../../packages/customer-api-client/dist/index.js';
import { isCustomerAddressComplete } from '../../packages/customer-validation/dist/index.js';

test('typed API errors expose backend validation payload without metadata', () => {
  const body = { full_name: ['This field is required.'] };
  const error = new CustomerApiError('Validation failed', 400, body);
  assert.equal(error.error, body);
  assert.equal(error.status, 400);
});

test('mapped Office addresses remain valid and incomplete addresses stay blocked', () => {
  const address = { label: 'Office', name: 'QA receiver', phone: '9000000088', line: 'QA only', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', latitude: 12.9716, longitude: 77.5946 };
  assert.equal(isCustomerAddressComplete(address), true);
  assert.equal(isCustomerAddressComplete({ ...address, phone: '' }), false);
  assert.equal(isCustomerAddressComplete({ ...address, label: 'unsupported' }), false);
});

test('address default uses PATCH while full edits retain PUT and pagination', async () => {
  const requests = [];
  const client = createCustomerApiClient({
    config: { apiBaseUrl: 'http://127.0.0.1:8000/api' },
    tokenStorage: { getAccessToken: () => null, getRefreshToken: () => null, setTokens: () => {}, clear: () => {} },
    transport: { request: async input => { requests.push(input); return {}; } },
  });
  await client.account.patchAddress('qa-id', { is_default: true });
  await client.account.updateAddress('qa-id', { full_name: 'QA receiver' });
  await client.account.addresses({ page: 2 });
  assert.equal(requests[0].method, 'PATCH');
  assert.deepEqual(requests[0].body, { is_default: true });
  assert.equal(requests[1].method, 'PUT');
  assert.match(requests[2].url, /page=2/);
});

test('missing server packaging fee never invents a fixed charge', () => {
  assert.equal(handlingFeeForItems([{quantity:1,price:120}]), 0);
  assert.equal(handlingFeeForItems([{quantity:1,price:120}], 3), 3);
});
