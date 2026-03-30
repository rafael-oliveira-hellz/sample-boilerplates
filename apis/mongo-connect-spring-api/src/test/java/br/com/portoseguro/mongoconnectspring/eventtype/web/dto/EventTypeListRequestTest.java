package br.com.portoseguro.mongoconnectspring.eventtype.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EventTypeListRequestTest {

    @Test
    void shouldNormalizeDefaults() {
        EventTypeListRequest request = new EventTypeListRequest();

        assertThat(request.normalizedSortBy()).isEqualTo("name");
        assertThat(request.normalizedDirection()).isEqualTo("desc");
        assertThat(request.normalizedSearch()).isNull();
    }
}