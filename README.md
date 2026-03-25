# G G Nursing Home Hub

## Admin Platform Setup (Firebase + Appwrite)

This project now uses:

- Firebase Authentication for admin login
- Appwrite Database for staff and attendance data
- Appwrite Database for appointments with status tracking

### 1) Configure environment variables

Copy `.env.example` to `.env` and fill the values.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_ATTENDANCE_EDITOR_EMAILS=
VITE_SUPER_ADMIN_EMAILS=

VITE_APPWRITE_ENDPOINT=
VITE_APPWRITE_PROJECT_ID=
VITE_APPWRITE_DATABASE_ID=
VITE_APPWRITE_STAFF_COLLECTION_ID=
VITE_APPWRITE_ATTENDANCE_COLLECTION_ID=
VITE_APPWRITE_APPOINTMENT_COLLECTION_ID=
VITE_APPWRITE_USER_ACCESS_COLLECTION_ID=
```

### 2) Firebase Authentication

- Enable Email/Password sign-in in Firebase Auth
- Create at least one owner account email/password and add it to `VITE_SUPER_ADMIN_EMAILS`
- New users can self-register from `/admin/register`
- Registered users stay pending until owner approval in Access Control

### 2.1) Optional role-style control for attendance edit access

- `VITE_ATTENDANCE_EDITOR_EMAILS` accepts a comma-separated list of emails
- When this variable is empty, every authenticated account can edit attendance
- When this variable is set, only listed emails can edit; other logged-in users are view-only

Example:

```env
VITE_ATTENDANCE_EDITOR_EMAILS=owner@example.com,manager@example.com,staff1@example.com
```

### 2.2) Owner-controlled login user permissions and access

- Add `VITE_SUPER_ADMIN_EMAILS` as a comma-separated list to bootstrap owner accounts
- Example: `VITE_SUPER_ADMIN_EMAILS=owner@example.com`
- Owners can open the in-app Access Control page and manage other login users

Create an Appwrite collection for user access with fields:

- `email` (string, required)
- `role` (string, required, one of `owner`, `editor`, `viewer`)
- `isActive` (boolean, required)
- `updatedBy` (string, optional)
- `updatedAt` (string, optional)

Behavior:

- `owner`: can manage users and edit attendance
- `editor`: can edit attendance
- `viewer`: read-only
- `isActive=false`: login is blocked until owner approval

### 3) Appwrite database collections

Create four collections in the configured database:

- Staff collection fields:
  - `name` (string, required)
  - `role` (string, required)
  - `phone` (string, optional)
  - `email` (string, optional)
- Attendance collection fields:
  - `date` (string, required, format `YYYY-MM-DD`)
  - `staffId` (string, required)
  - `status` (string, required, one of `present`, `absent`, `leave`, `off`, `half-time`, `over-time`)
- Appointment collection fields:
  - `name` (string, required)
  - `email` (string, required)
  - `phone` (string, required)
  - `doctor` (string, required)
  - `message` (string, required)
  - `status` (string, required, one of `booked`, `completed`)
  - `completedAt` (string, optional)
- User Access collection fields:
  - `email` (string, required)
  - `role` (string, required)
  - `isActive` (boolean, required)
  - `updatedBy` (string, optional)
  - `updatedAt` (string, optional)

For quick development, allow client operations needed by the app on these collections.

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
