# G G Nursing Home Hub

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
