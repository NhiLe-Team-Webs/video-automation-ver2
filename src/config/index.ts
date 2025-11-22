import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface SystemConfig {
  autoEditor: {
    margin: string;
    threshold: number;
    fastMode: boolean;
    skipThreshold: number;
  };
  whisper: {
    model: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  googleSheets: {
    spreadsheetId: string;
    credentials: string;
  };
  pexels: {
    apiKey: string;
  };
  soundEffects: {
    apiKey: string;
    apiProvider: 'pixabay' | 'freesound';
    cacheEnabled: boolean;
  };
  notifications: {
    method: 'email' | 'webhook' | 'sms' | 'telegram';
    endpoint: string;
    operatorEmail?: string;
    telegram?: {
      botToken: string;
      chatId: string;
    };
  };
  storage: {
    tempDir: string;
    cacheDir: string;
    sfxCacheDir: string;
    wasabi: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  server: {
    port: number;
    env: string;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const config: SystemConfig = {
  autoEditor: {
    margin: '0.2sec',
    threshold: 0.04,
    fastMode: false, // Enable fast mode for large files
    skipThreshold: 300, // Skip auto editing for files longer than 5 minutes
  },
  whisper: {
    model: getOptionalEnvVar('WHISPER_MODEL', 'base'),
  },
  gemini: {
    apiKey: getOptionalEnvVar('GEMINI_API_KEY'),
    model: getOptionalEnvVar('GEMINI_MODEL', 'gemini-pro'),
  },
  googleSheets: {
    spreadsheetId: getOptionalEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID'),
    credentials: getOptionalEnvVar('GOOGLE_SHEETS_CREDENTIALS'),
  },
  pexels: {
    apiKey: getOptionalEnvVar('PEXELS_API_KEY'),
  },
  soundEffects: {
    apiKey: getOptionalEnvVar('PIXABAY_API_KEY'),
    apiProvider: (process.env.SOUND_EFFECTS_PROVIDER || 'pixabay') as 'pixabay' | 'freesound',
    cacheEnabled: process.env.SOUND_EFFECTS_CACHE_ENABLED !== 'false',
  },
  notifications: {
    method: (process.env.NOTIFICATION_METHOD || 'webhook') as 'email' | 'webhook' | 'sms' | 'telegram',
    endpoint: process.env.NOTIFICATION_ENDPOINT || '',
    operatorEmail: process.env.NOTIFICATION_OPERATOR_EMAIL,
    telegram: process.env.TELEGRAM_BOT_TOKEN
      ? {
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          chatId: getOptionalEnvVar('TELEGRAM_CHAT_ID'),
        }
      : undefined,
  },
  storage: {
    tempDir: path.resolve(getOptionalEnvVar('TEMP_DIR', './temp')),
    cacheDir: path.resolve(getOptionalEnvVar('CACHE_DIR', './cache')),
    sfxCacheDir: path.resolve(getOptionalEnvVar('SFX_CACHE_DIR', './cache/sfx')),
    wasabi: {
      bucket: getOptionalEnvVar('WASABI_BUCKET'),
      region: getOptionalEnvVar('WASABI_REGION', 'us-east-1'),
      accessKeyId: getOptionalEnvVar('WASABI_ACCESS_KEY_ID'),
      secretAccessKey: getOptionalEnvVar('WASABI_SECRET_ACCESS_KEY'),
    },
  },
  server: {
    port: parseInt(getOptionalEnvVar('PORT', '3000'), 10),
    env: getOptionalEnvVar('NODE_ENV', 'development'),
  },
};
