/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMS_WEBHOOK_URL?: string;
  readonly VITE_WHATSAPP_WEBHOOK_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_APPWRITE_ENDPOINT?: string;
  readonly VITE_APPWRITE_PROJECT_ID?: string;
  readonly VITE_APPWRITE_DATABASE_ID?: string;
  readonly VITE_APPWRITE_STAFF_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_ATTENDANCE_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_APPOINTMENT_COLLECTION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
