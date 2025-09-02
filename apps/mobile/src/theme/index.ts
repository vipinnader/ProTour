/**
 * ProTour app theme configuration
 */

import { extendTheme } from 'native-base';

// Color palette for ProTour
const colors = {
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3', // Main brand color
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },
  secondary: {
    50: '#fce4ec',
    100: '#f8bbd9',
    200: '#f48fb1',
    300: '#f06292',
    400: '#ec407a',
    500: '#e91e63',
    600: '#d81b60',
    700: '#c2185b',
    800: '#ad1457',
    900: '#880e4f',
  },
  success: {
    50: '#e8f5e8',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50',
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
  },
  warning: {
    50: '#fff8e1',
    100: '#ffecb3',
    200: '#ffe082',
    300: '#ffd54f',
    400: '#ffca28',
    500: '#ffc107',
    600: '#ffb300',
    700: '#ffa000',
    800: '#ff8f00',
    900: '#ff6f00',
  },
  error: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336',
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
  },
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  // Tournament status colors
  tournament: {
    draft: '#9e9e9e',
    open: '#4caf50',
    inProgress: '#ff9800',
    completed: '#2196f3',
    cancelled: '#f44336',
  },
  // Match status colors
  match: {
    scheduled: '#2196f3',
    inProgress: '#ff9800',
    completed: '#4caf50',
    cancelled: '#f44336',
  },
};

// Typography
const fonts = {
  heading: 'System', // iOS: SF Pro Display, Android: Roboto
  body: 'System', // iOS: SF Pro Text, Android: Roboto
  mono: 'Courier', // Monospace font for codes/IDs
};

const fontSizes = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
};

// Component themes
const components = {
  Button: {
    baseStyle: {
      rounded: 'md',
      _text: {
        fontWeight: 'semibold',
      },
    },
    variants: {
      solid: (props: any) => ({
        bg: `${props.colorScheme}.500`,
        _pressed: {
          bg: `${props.colorScheme}.600`,
        },
        _disabled: {
          bg: 'gray.300',
          _text: {
            color: 'gray.500',
          },
        },
      }),
      outline: (props: any) => ({
        borderWidth: 2,
        borderColor: `${props.colorScheme}.500`,
        _text: {
          color: `${props.colorScheme}.500`,
        },
        _pressed: {
          bg: `${props.colorScheme}.50`,
        },
      }),
      ghost: (props: any) => ({
        _text: {
          color: `${props.colorScheme}.500`,
        },
        _pressed: {
          bg: `${props.colorScheme}.50`,
        },
      }),
    },
    sizes: {
      sm: {
        px: 3,
        py: 2,
        _text: {
          fontSize: 'sm',
        },
      },
      md: {
        px: 4,
        py: 3,
        _text: {
          fontSize: 'md',
        },
      },
      lg: {
        px: 6,
        py: 4,
        _text: {
          fontSize: 'lg',
        },
      },
    },
    defaultProps: {
      size: 'md',
      variant: 'solid',
      colorScheme: 'primary',
    },
  },
  
  Card: {
    baseStyle: {
      bg: 'white',
      rounded: 'lg',
      shadow: 2,
      p: 4,
    },
  },

  Input: {
    baseStyle: {
      borderWidth: 1,
      borderColor: 'gray.300',
      rounded: 'md',
      px: 3,
      py: 2,
      _focus: {
        borderColor: 'primary.500',
      },
      _invalid: {
        borderColor: 'error.500',
      },
    },
  },

  FormControl: {
    baseStyle: {
      _invalid: {
        _text: {
          color: 'error.500',
        },
      },
    },
  },
};

// Configuration
const config = {
  useSystemColorMode: false,
  initialColorMode: 'light',
};

export const theme = extendTheme({
  colors,
  fonts,
  fontSizes,
  components,
  config,
});

export default theme;