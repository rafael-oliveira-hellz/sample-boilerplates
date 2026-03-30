package br.com.portoseguro.mongoconnectspring.partner.web.dto;

import java.time.Instant;
import java.util.UUID;

public record PartnerResponse(UUID id, String name, String description, Boolean active, Boolean deleted, Instant createdAt, Instant updatedAt) {
}