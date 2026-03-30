package br.com.portoseguro.mongoconnectspring.eventtype.web.mapper;

import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeResponse;
import org.springframework.stereotype.Component;

@Component
public class EventTypeMapper {

    public EventTypeResponse toResponse(EventType eventType) {
        return new EventTypeResponse(
                eventType.getId(),
                eventType.getName(),
                eventType.getDescription(),
                eventType.getActive(),
                eventType.getCreatedAt(),
                eventType.getUpdatedAt()
        );
    }
}
