package br.com.portoseguro.mongoconnectspring.common.security;

import jakarta.servlet.Filter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RequestSecurityFilterConfig {

    private final AppSecurityProperties properties;

    public RequestSecurityFilterConfig(AppSecurityProperties properties) {
        this.properties = properties;
    }

    @Bean
    @ConditionalOnBean(name = "requestSecurityFilter")
    FilterRegistrationBean<Filter> requestSecurityFilterRegistration(
            @Qualifier("requestSecurityFilter") Filter requestSecurityFilter
    ) {
        FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
        registration.setFilter(requestSecurityFilter);
        properties.getCorporateFilter().getUrlPatterns().forEach(registration::addUrlPatterns);
        registration.setEnabled(properties.getCorporateFilter().isEnabled());
        registration.setOrder(properties.getCorporateFilter().getOrder());
        return registration;
    }
}
