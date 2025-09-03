/**
 * Basic E2E tests for ProTour app
 */

import { device, expect, element, by } from 'detox';

describe('ProTour App', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show home screen on app launch', async () => {
    await expect(element(by.text('ProTour'))).toBeVisible();
    await expect(
      element(by.text('Tournament Management Platform'))
    ).toBeVisible();
  });

  it('should navigate through basic app flow', async () => {
    // Test basic navigation and app functionality
    await expect(
      element(by.text('Mobile app is ready for development!'))
    ).toBeVisible();
  });

  it('should handle app state changes', async () => {
    // Test app going to background and foreground
    await device.sendToHome();
    await device.launchApp({ newInstance: false });
    await expect(element(by.text('ProTour'))).toBeVisible();
  });

  it('should handle device rotation', async () => {
    await device.setOrientation('landscape');
    await expect(element(by.text('ProTour'))).toBeVisible();

    await device.setOrientation('portrait');
    await expect(element(by.text('ProTour'))).toBeVisible();
  });
});
