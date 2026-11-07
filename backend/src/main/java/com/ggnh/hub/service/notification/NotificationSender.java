package com.ggnh.hub.service.notification;

import com.ggnh.hub.entity.AppointmentOutbox;

public interface NotificationSender {

    boolean supports(String channel);

    void send(AppointmentOutbox outbox) throws NotificationDeliveryException;
}

