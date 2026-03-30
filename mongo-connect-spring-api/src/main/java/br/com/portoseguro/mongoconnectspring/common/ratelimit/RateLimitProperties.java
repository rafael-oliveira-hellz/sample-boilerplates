package br.com.portoseguro.mongoconnectspring.common.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "application.rate-limit")
public record RateLimitProperties(
        boolean enabled,
        int requests,
        int windowSeconds
) {

    public int normalizedRequests() {
        return requests <= 0 ? 120 : requests;
    }

    public int normalizedWindowSeconds() {
        return windowSeconds <= 0 ? 60 : windowSeconds;
    }
}