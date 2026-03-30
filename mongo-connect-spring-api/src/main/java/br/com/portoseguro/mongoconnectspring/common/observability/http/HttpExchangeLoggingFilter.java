package br.com.portoseguro.mongoconnectspring.common.observability.http;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component
public class HttpExchangeLoggingFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(HttpExchangeLoggingFilter.class);

    private final TraceCorrelation traceCorrelation;
    private final HttpExchangeLogProperties properties;
    private final ObjectMapper objectMapper;

    public HttpExchangeLoggingFilter(
            TraceCorrelation traceCorrelation,
            HttpExchangeLogProperties properties,
            ObjectMapper objectMapper
    ) {
        this.traceCorrelation = traceCorrelation;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !properties.isEnabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request, Math.max(properties.getMaxPayloadLength(), 256));
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        long startedAt = System.currentTimeMillis();

        try {
            filterChain.doFilter(wrappedRequest, wrappedResponse);
        } finally {
            traceCorrelation.traceId().ifPresent(traceId -> wrappedResponse.setHeader("X-Trace-Id", traceId));
            traceCorrelation.spanId().ifPresent(spanId -> wrappedResponse.setHeader("X-Span-Id", spanId));

            if (shouldLog(wrappedResponse.getStatus())) {
                LOGGER.info(buildStructuredLog(wrappedRequest, wrappedResponse, System.currentTimeMillis() - startedAt));
            }
            wrappedResponse.copyBodyToResponse();
        }
    }

    private boolean shouldLog(int status) {
        if (status >= 400) {
            return true;
        }
        int sample = properties.normalizedSuccessSamplePercent();
        return sample > 0 && ThreadLocalRandom.current().nextInt(100) < sample;
    }

    private String buildStructuredLog(ContentCachingRequestWrapper request, ContentCachingResponseWrapper response, long durationMs) {
        boolean includeBodies = properties.isLogBodies() || (properties.isLogBodiesOnError() && response.getStatus() >= 400);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "http_exchange");
        payload.put("traceId", traceCorrelation.traceId().orElse(""));
        payload.put("spanId", traceCorrelation.spanId().orElse(""));
        payload.put("method", request.getMethod());
        payload.put("path", request.getRequestURI());
        payload.put("query", request.getQueryString());
        payload.put("status", response.getStatus());
        payload.put("durationMs", durationMs);
        payload.put("request", buildRequestObject(request, includeBodies));
        payload.put("response", buildResponseObject(response, includeBodies));
        return writeJson(payload);
    }

    private String writeJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            LOGGER.warn("Falha ao serializar log estruturado HTTP.", exception);
            return "{\"event\":\"http_exchange\",\"serializationError\":true}";
        }
    }

    private Map<String, Object> buildRequestObject(ContentCachingRequestWrapper request, boolean includeBodies) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contentType", request.getContentType());
        payload.put("headers", sanitizeHeaders(extractHeaders(request)));
        payload.put("parameters", request.getParameterMap());
        payload.put("body", includeBodies ? extractBody(request.getContentAsByteArray(), request.getContentType()) : "[omitted]");
        return payload;
    }

    private Map<String, Object> buildResponseObject(ContentCachingResponseWrapper response, boolean includeBodies) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contentType", response.getContentType());
        payload.put("headers", sanitizeHeaders(extractHeaders(response)));
        payload.put("body", includeBodies ? extractBody(response.getContentAsByteArray(), response.getContentType()) : "[omitted]");
        return payload;
    }

    private Map<String, String> extractHeaders(HttpServletRequest request) {
        Map<String, String> headers = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names == null) {
            return headers;
        }
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            headers.put(name, request.getHeader(name));
        }
        return headers;
    }

    private Map<String, String> extractHeaders(HttpServletResponse response) {
        Map<String, String> headers = new LinkedHashMap<>();
        for (String name : response.getHeaderNames()) {
            headers.put(name, response.getHeader(name));
        }
        return headers;
    }

    private Map<String, String> sanitizeHeaders(Map<String, String> headers) {
        if (headers.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, String> sanitized = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String key = entry.getKey();
            String value = properties.getRedactedHeaders().contains(key.toLowerCase()) ? "***REDACTED***" : entry.getValue();
            sanitized.put(key, value);
        }
        return sanitized;
    }

    private String extractBody(byte[] content, String contentType) {
        if (content == null || content.length == 0) {
            return null;
        }
        if (contentType == null) {
            return truncate(new String(content, StandardCharsets.UTF_8));
        }
        String lowered = contentType.toLowerCase();
        if (lowered.contains(MediaType.APPLICATION_JSON_VALUE) || lowered.startsWith("text/") || lowered.contains("+json")) {
            return truncate(new String(content, StandardCharsets.UTF_8));
        }
        return "[omitted-non-text-body]";
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        int max = Math.max(properties.getMaxPayloadLength(), 256);
        return value.length() <= max ? value : value.substring(0, max) + "...[truncated]";
    }
}