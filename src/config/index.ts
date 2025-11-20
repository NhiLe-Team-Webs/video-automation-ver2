import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface SystemConfig {
  autoEditor: {
    margin: string;
    threshold: number;
  };
  whisper: {
    model: string;
    useLocal: boolean;
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
  youtube: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  notifications: {
    method: 'email' | 'webhook' | 'sms';
    endpoint: string;
    operatorEmail?: string;
  };
  storage: {
    tempDir: string;
    cacheDir: string;
  };
  redis: {
    host: string;
    port: number;
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

export const config: SystemConfig = {
  autoEditor: {
    margin: '0.2sec',
    threshold: 0.04,
  },
  whisper: {
    model: getEnvVar('WHISPER_MODEL', 'base'),
    useLocal: true,
  },
  gemini: {
    apiKey: getEnvVar('GEMINI_API_KEY'),
    model: getEnvVar('GEMINI_MODEL', 'gemini-pro'),
  },
  googleSheets: {
    spreadsheetId: getEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID'),
    credentials: getEnvVar('GOOGLE_SHEETS_CREDENTIALS'),
  },
  pexels: {
    apiKey: getEnvVar('PEXELS_API_KEY'),
  },
  youtube: {
    clientId: getEnvVar('YOUTUBE_CLIENT_ID'),
    clientSecret: getEnvVar('YOUTUBE_CLIENT_SECRET'),
    redirectUri: getEnvVar('YOUTUBE_REDIRECT_URI'),
  },
  notifications: {
    method: (process.env.NOTIFICATION_METHOD || 'webhook') as 'email' | 'webhook' | 'sms',
    endpoint: process.env.NOTIFICATION_ENDPOINT || '',
    operatorEmail: process.env.NOTIFICATION_OPERATOR_EMAIL,
  },
  storage: {
    tempDir: path.resolve(getEnvVar('TEMP_DIR', './temp')),
    cacheDir: path.resolve(getEnvVar('CACHE_DIR', './cache')),
  },
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: parseInt(getEnvVar('REDIS_PORT', '6379'), 10),
  },
  server: {
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    env: getEnvVar('NODE_ENV', 'development'),
  },
};
