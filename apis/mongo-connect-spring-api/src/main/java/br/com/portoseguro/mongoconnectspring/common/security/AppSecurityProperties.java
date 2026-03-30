package br.com.portoseguro.mongoconnectspring.common.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "application.security")
public class AppSecurityProperties {

    private Cors cors = new Cors();
    private Headers headers = new Headers();
    private CorporateFilter corporateFilter = new CorporateFilter();

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public Headers getHeaders() {
        return headers;
    }

    public void setHeaders(Headers headers) {
        this.headers = headers;
    }

    public CorporateFilter getCorporateFilter() {
        return corporateFilter;
    }

    public void setCorporateFilter(CorporateFilter corporateFilter) {
        this.corporateFilter = corporateFilter;
    }

    public static class Cors {
        private List<String> allowedOrigins = List.of();
        private List<String> allowedMethods = List.of("GET", "POST", "PUT", "PATCH", "DELETE");
        private List<String> allowedHeaders = List.of("Content-Type", "Accept", "Authorization", "X-Request-Id", "traceparent", "tracestate");
        private List<String> exposedHeaders = List.of("X-Trace-Id", "X-Span-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After");
        private boolean allowCredentials;
        private long maxAgeSeconds = 3600;

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }

        public List<String> getAllowedMethods() {
            return allowedMethods;
        }

        public void setAllowedMethods(List<String> allowedMethods) {
            this.allowedMethods = allowedMethods;
        }

        public List<String> getAllowedHeaders() {
            return allowedHeaders;
        }

        public void setAllowedHeaders(List<String> allowedHeaders) {
            this.allowedHeaders = allowedHeaders;
        }

        public List<String> getExposedHeaders() {
            return exposedHeaders;
        }

        public void setExposedHeaders(List<String> exposedHeaders) {
            this.exposedHeaders = exposedHeaders;
        }

        public boolean isAllowCredentials() {
            return allowCredentials;
        }

        public void setAllowCredentials(boolean allowCredentials) {
            this.allowCredentials = allowCredentials;
        }

        public long getMaxAgeSeconds() {
            return maxAgeSeconds;
        }

        public void setMaxAgeSeconds(long maxAgeSeconds) {
            this.maxAgeSeconds = maxAgeSeconds;
        }
    }

    public static class Headers {
        private boolean hstsEnabled = true;

        public boolean isHstsEnabled() {
            return hstsEnabled;
        }

        public void setHstsEnabled(boolean hstsEnabled) {
            this.hstsEnabled = hstsEnabled;
        }
    }

    public static class CorporateFilter {
        private boolean enabled = true;
        private boolean required = true;
        private String expectedClassName = "com.porto.segurancadainformacao.securitytyfilter.filter.RequestSecurityFilter";
        private int order = 2;
        private List<String> urlPatterns = List.of("/v1/*", "/v2/*", "/api/*");

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public boolean isRequired() {
            return required;
        }

        public void setRequired(boolean required) {
            this.required = required;
        }

        public String getExpectedClassName() {
            return expectedClassName;
        }

        public void setExpectedClassName(String expectedClassName) {
            this.expectedClassName = expectedClassName;
        }

        public int getOrder() {
            return order;
        }

        public void setOrder(int order) {
            this.order = order;
        }

        public List<String> getUrlPatterns() {
            return urlPatterns;
        }

        public void setUrlPatterns(List<String> urlPatterns) {
            this.urlPatterns = urlPatterns;
        }
    }
}