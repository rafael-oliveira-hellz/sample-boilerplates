package br.com.portoseguro.mongoconnectspring.partner.web.dto;

import jakarta.validation.constraints.NotNull;

public record PartnerStatusRequest(@NotNull(message = "[active] deve ser informado") Boolean active) {
}