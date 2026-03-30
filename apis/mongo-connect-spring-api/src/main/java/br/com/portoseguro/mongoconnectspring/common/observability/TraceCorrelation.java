package br.com.portoseguro.mongoconnectspring.common.observability;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import java.util.Optional;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class TraceCorrelation {

    public Optional<String> traceId() {
        SpanContext spanContext = Span.current().getSpanContext();
        if (spanContext.isValid()) {
            return Optional.of(spanContext.getTraceId());
        }
        return mdcValue("dd.trace_id");
    }

    public Optional<String> spanId() {
        SpanContext spanContext = Span.current().getSpanContext();
        if (spanContext.isValid()) {
            return Optional.of(spanContext.getSpanId());
        }
        return mdcValue("dd.span_id");
    }

    private Optional<String> mdcValue(String key) {
        String value = MDC.get(key);
        if (value == null || value.isBlank() || "0".equals(value)) {
            return Optional.empty();
        }
        return Optional.of(value);
    }
}
