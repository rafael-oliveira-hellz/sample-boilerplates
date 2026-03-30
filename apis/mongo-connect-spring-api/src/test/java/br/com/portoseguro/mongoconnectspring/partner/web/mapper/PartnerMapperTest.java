package br.com.portoseguro.mongoconnectspring.partner.web.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import org.junit.jupiter.api.Test;

class PartnerMapperTest {

    private final PartnerMapper mapper = new PartnerMapper();

    @Test
    void shouldMapPartnerToResponse() {
        Partner partner = new Partner();
        partner.setName("Parceiro");
        partner.setDeleted(false);

        assertThat(mapper.toResponse(partner).name()).isEqualTo("Parceiro");
        assertThat(mapper.toResponse(partner).deleted()).isFalse();
    }
}