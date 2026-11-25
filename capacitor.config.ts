interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: { androidScheme?: string };
  android?: { allowMixedContent?: boolean; backgroundColor?: string };
  plugins?: Record<string, Record<string, unknown>>;
}

const config: CapacitorConfig = {
  appId: 'com.baqalatypro.pos',
  appName: 'بقالتي برو',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0B3D2E',
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
      iosIsEncryption: true,
    },
  },
};

export default config;
