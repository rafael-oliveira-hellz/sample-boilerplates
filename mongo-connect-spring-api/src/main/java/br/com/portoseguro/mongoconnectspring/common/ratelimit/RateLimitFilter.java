package br.com.portoseguro.mongoconnectspring.common.ratelimit;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, WindowCounter> counters = new ConcurrentHashMap<>();
    private final RateLimitProperties properties;
    private final TraceCorrelation traceCorrelation;

    public RateLimitFilter(
            RateLimitProperties properties,
            TraceCorrelation traceCorrelation
    ) {
        this.properties = properties;
        this.traceCorrelation = traceCorrelation;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !properties.enabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String clientKey = resolveClientKey(request);
        RateLimitDecision decision = reserve(clientKey);

        response.setHeader("X-RateLimit-Limit", String.valueOf(properties.normalizedRequests()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(decision.resetEpochSeconds()));

        if (decision.blocked()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
            response.getWriter().write(buildBody(request.getRequestURI()));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String buildBody(String path) {
        String traceId = traceCorrelation.traceId().orElse("");
        String spanId = traceCorrelation.spanId().orElse("");
        return "{" +
                "\"timestamp\":\"" + Instant.now() + "\"," +
                "\"status\":429," +
                "\"error\":\"Too Many Requests\"," +
                "\"message\":\"Limite de requisicoes excedido. Tente novamente em instantes.\"," +
                "\"path\":\"" + escapeJson(path) + "\"," +
                "\"traceId\":\"" + escapeJson(traceId) + "\"," +
                "\"spanId\":\"" + escapeJson(spanId) + "\"," +
                "\"fields\":{}" +
                "}";
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private RateLimitDecision reserve(String clientKey) {
        long now = System.currentTimeMillis();
        long windowMillis = properties.normalizedWindowSeconds() * 1000L;

        WindowCounter current = counters.get(clientKey);
        if (current == null || now >= current.windowStart() + windowMillis) {
            WindowCounter fresh = new WindowCounter(now, 1);
            counters.put(clientKey, fresh);
            return decisionFor(fresh, false, now, windowMillis);
        }

        if (current.count() >= properties.normalizedRequests()) {
            return decisionFor(current, true, now, windowMillis);
        }

        WindowCounter updated = new WindowCounter(current.windowStart(), current.count() + 1);
        counters.put(clientKey, updated);
        return decisionFor(updated, false, now, windowMillis);
    }

    private RateLimitDecision decisionFor(WindowCounter counter, boolean blocked, long now, long windowMillis) {
        long resetAtMillis = counter.windowStart() + windowMillis;
        int remaining = Math.max(properties.normalizedRequests() - counter.count(), 0);
        long retryAfter = Math.max((resetAtMillis - now + 999) / 1000, 1);
        return new RateLimitDecision(blocked, remaining, resetAtMillis / 1000, retryAfter);
    }

    private String
    resolveClientKey(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record  WindowCounter(long windowStart, int count) {
    }

    private record RateLimitDecision(boolean blocked, int remaining, long resetEpochSeconds, long retryAfterSeconds) {
    }
}
