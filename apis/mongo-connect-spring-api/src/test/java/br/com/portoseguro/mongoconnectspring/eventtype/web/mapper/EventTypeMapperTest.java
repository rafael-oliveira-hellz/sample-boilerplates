package br.com.portoseguro.mongoconnectspring.eventtype.web.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import org.junit.jupiter.api.Test;

class EventTypeMapperTest {

    private final EventTypeMapper mapper = new EventTypeMapper();

    @Test
    void shouldMapEventTypeToResponse() {
        EventType eventType = new EventType();
        eventType.setName("Evento");
        eventType.setDescription("Descricao");
        eventType.setActive(true);

        assertThat(mapper.toResponse(eventType).name()).isEqualTo("Evento");
        assertThat(mapper.toResponse(eventType).active()).isTrue();
    }
}