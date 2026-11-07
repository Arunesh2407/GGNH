package com.ggnh.hub.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAppointmentRequest {

    @NotBlank(message = "Patient name is required")
    @Size(max = 200, message = "Patient name must not exceed 200 characters")
    @JsonProperty("patientName")
    @JsonAlias({"name", "patientName"})
    private String patientName;

    @Pattern(
        regexp = "^$|^[Nn]ot [Pp]rovided$|(?i)^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
        message = "Patient email must be a valid email address if provided"
    )
    @Size(max = 255, message = "Patient email must not exceed 255 characters")
    @JsonProperty("patientEmail")
    @JsonAlias({"email", "patientEmail"})
    private String patientEmail;

    @NotBlank(message = "Patient phone is required")
    @Size(min = 7, max = 50, message = "Patient phone must be between 7 and 50 characters")
    @JsonProperty("patientPhone")
    @JsonAlias({"phone", "patientPhone"})
    private String patientPhone;

    @Size(max = 150, message = "Doctor name must not exceed 150 characters")
    @JsonProperty("doctorName")
    @JsonAlias({"doctor", "doctorName"})
    private String doctorName;

    @Size(max = 2000, message = "Message must not exceed 2000 characters")
    private String message;

    @JsonProperty("appointmentDate")
    @JsonAlias({"date", "appointmentDate"})
    private LocalDate appointmentDate;

    @Size(max = 50, message = "Time slot must not exceed 50 characters")
    @JsonProperty("timeSlot")
    @JsonAlias({"slot", "timeSlot"})
    private String timeSlot;

    public String getResolvedName() {
        return patientName != null ? patientName.trim() : "";
    }

    public String getResolvedPhone() {
        return patientPhone != null ? patientPhone.trim() : "";
    }

    public String getResolvedEmail() {
        if (patientEmail == null) {
            return null;
        }
        String trimmed = patientEmail.trim();
        if (trimmed.isEmpty() || "Not provided".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }

    public String getResolvedDoctor() {
        if (doctorName == null) {
            return "Not selected";
        }
        String trimmed = doctorName.trim();
        return trimmed.isEmpty() ? "Not selected" : trimmed;
    }

    public String getResolvedMessage() {
        if (message == null) {
            return null;
        }
        String trimmed = message.trim();
        if (trimmed.isEmpty() || "Not provided".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }
}
