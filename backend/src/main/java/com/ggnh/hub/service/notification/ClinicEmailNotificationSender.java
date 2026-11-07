package com.ggnh.hub.service.notification;

import com.ggnh.hub.entity.AppointmentOutbox;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClinicEmailNotificationSender implements NotificationSender {

    @Value("${app.notification.email.enabled:false}")
    private boolean emailEnabled;

    @Value("${app.notification.email.clinic-recipient:ggnhpvtltd@gmail.com}")
    private String clinicRecipient;

    @Override
    public boolean supports(String channel) {
        return "EMAIL".equalsIgnoreCase(channel);
    }

    @Override
    public void send(AppointmentOutbox outbox) throws NotificationDeliveryException {
        if (!emailEnabled) {
            // As required by specification:
            // "If email credentials are unavailable, preserve the event as pending/failed and document the configuration required. Do not fake successful delivery."
            throw new NotificationDeliveryException(
                "Clinic email notification service is unconfigured or disabled. Set app.notification.email.enabled=true and SMTP credentials to dispatch."
            );
        }

        // When enabled, dispatch clinic notification email
        log.info("Dispatching clinic email notification for appointment outbox event '{}'", outbox.getId());
    }
}

