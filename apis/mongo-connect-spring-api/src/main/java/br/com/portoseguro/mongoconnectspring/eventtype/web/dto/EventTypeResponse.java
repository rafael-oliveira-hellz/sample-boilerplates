package br.com.portoseguro.mongoconnectspring.eventtype.web.dto;

import java.time.Instant;
import java.util.UUID;

public record EventTypeResponse(
        UUID id,
        String name,
        String description,
        Boolean active,
        Instant createdAt,
        Instant updatedAt
) {
}
