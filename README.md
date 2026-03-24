# G G Nursing Home Hub

## Admin Platform Setup (Firebase + Appwrite)

This project now uses:

- Firebase Authentication for admin login
- Appwrite Database for staff and attendance data

### 1) Configure environment variables

Copy `.env.example` to `.env` and fill the values.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

VITE_APPWRITE_ENDPOINT=
VITE_APPWRITE_PROJECT_ID=
VITE_APPWRITE_DATABASE_ID=
VITE_APPWRITE_STAFF_COLLECTION_ID=
VITE_APPWRITE_ATTENDANCE_COLLECTION_ID=
```

### 2) Firebase Authentication

- Enable Email/Password sign-in in Firebase Auth
- Create at least one admin user account using email/password

### 3) Appwrite database collections

Create two collections in the configured database:

- Staff collection fields:
  - `name` (string, required)
  - `role` (string, required)
  - `phone` (string, optional)
  - `email` (string, optional)
- Attendance collection fields:
  - `date` (string, required, format `YYYY-MM-DD`)
  - `staffId` (string, required)
  - `status` (string, required, one of `present`, `absent`, `leave`, `off`)

For quick development, allow authenticated users to create/read/update/delete documents in these collections.

### Future expansion

The project now has a dedicated data service layer in `src/services/` so pharmacy and inventory modules can add their own services and collections without changing page-level UI logic.

## Appointment Notifications

The appointment form in Contact now sends a real email to `ggnhpvtltd@gmail.com` using FormSubmit.

### Email flow (already active)

- Form posts to `https://formsubmit.co/ajax/ggnhpvtltd@gmail.com`
- On success, user sees a success toast

### Optional SMS and WhatsApp notifications to `7649891060`

Set webhook endpoints in `.env` (or `.env.local`) if you have an SMS/WhatsApp provider:

```env
VITE_SMS_WEBHOOK_URL=https://your-sms-endpoint.example.com/notify
VITE_WHATSAPP_WEBHOOK_URL=https://your-whatsapp-endpoint.example.com/notify
```

Each webhook receives JSON payload:

```json
{
  "to": "7649891060",
  "type": "appointment",
  "appointment": {
    "name": "Patient Name",
    "phone": "Patient Phone",
    "email": "Patient Email",
    "department": "Selected Department",
    "message": "Patient concern"
  }
}
```

If webhook URLs are not set, only email is sent.
