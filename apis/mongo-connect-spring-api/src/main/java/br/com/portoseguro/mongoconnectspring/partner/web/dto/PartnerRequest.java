package br.com.portoseguro.mongoconnectspring.partner.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PartnerRequest(
        @NotBlank(message = "[name] deve ser informado")
        @Size(min = 3, message = "[name] deve ter no minimo 3 caracteres")
        @Size(max = 120, message = "[name] deve ter no maximo 120 caracteres")
        String name,
        @Size(max = 255, message = "[description] deve ter no maximo 255 caracteres")
        String description,
        Boolean active
) {
}