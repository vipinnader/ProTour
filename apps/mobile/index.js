/**
 * ProTour Mobile App Entry Point
 */

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Register the main component
AppRegistry.registerComponent(appName, () => App);
