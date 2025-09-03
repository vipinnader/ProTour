/**
 * E2E test setup for ProTour
 */

import { device, cleanup, init } from 'detox';

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await cleanup();
});
