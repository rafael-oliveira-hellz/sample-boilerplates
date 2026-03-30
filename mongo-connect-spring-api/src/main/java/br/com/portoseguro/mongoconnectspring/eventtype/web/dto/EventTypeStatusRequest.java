package br.com.portoseguro.mongoconnectspring.eventtype.web.dto;

import jakarta.validation.constraints.NotNull;

public record EventTypeStatusRequest(
        @NotNull(message = "[active] deve ser informado") Boolean active
) {
}
