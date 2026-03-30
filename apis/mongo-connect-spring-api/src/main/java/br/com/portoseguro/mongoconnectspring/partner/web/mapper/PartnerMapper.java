package br.com.portoseguro.mongoconnectspring.partner.web.mapper;

import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerResponse;
import org.springframework.stereotype.Component;

@Component
public class PartnerMapper {

    public PartnerResponse toResponse(Partner partner) {
        return new PartnerResponse(partner.getId(), partner.getName(), partner.getDescription(), partner.getActive(), partner.getDeleted(), partner.getCreatedAt(), partner.getUpdatedAt());
    }
}