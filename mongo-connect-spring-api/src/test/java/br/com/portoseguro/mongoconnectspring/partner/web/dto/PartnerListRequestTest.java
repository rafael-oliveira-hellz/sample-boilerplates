package br.com.portoseguro.mongoconnectspring.partner.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PartnerListRequestTest {

    @Test
    void shouldFallbackDirectionToDesc() {
        PartnerListRequest request = new PartnerListRequest();
        request.setDirection(" ");

        assertThat(request.normalizedDirection()).isEqualTo("desc");
    }
}