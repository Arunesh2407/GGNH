package com.ggnh.hub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class GgnhApplicationTests {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void contextLoads() {
    }

    @Test
    @DisplayName("UserDetailsServiceAutoConfiguration should be excluded, ensuring no default security user or password exists")
    void userDetailsServiceAutoConfiguration_IsExcluded() {
        assertThrows(NoSuchBeanDefinitionException.class, () ->
                applicationContext.getBean(UserDetailsService.class)
        );
    }
}

