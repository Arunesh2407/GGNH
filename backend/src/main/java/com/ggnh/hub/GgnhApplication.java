package com.ggnh.hub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
public class GgnhApplication {

    public static void main(String[] args) {
        SpringApplication.run(GgnhApplication.class, args);
    }
}

