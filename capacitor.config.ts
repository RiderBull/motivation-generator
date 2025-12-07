import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.motivation.generator',
  appName: 'Motivation Generator',
  webDir: 'out',
  server: {
    url: 'https://motivation-generator-cyan.vercel.app',
    cleartext: true
  }
};

export default config;
