package br.com.portoseguro.mongoconnectspring.common.web.error;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        String traceId,
        String spanId,
        Map<String, String> fields
) {
}
