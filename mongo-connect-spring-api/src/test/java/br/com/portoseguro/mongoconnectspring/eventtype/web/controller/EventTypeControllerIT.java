package br.com.portoseguro.mongoconnectspring.eventtype.web.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import br.com.portoseguro.mongoconnectspring.common.web.error.ApiErrorHandler;
import br.com.portoseguro.mongoconnectspring.common.web.filter.RequestPathFilter;
import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import br.com.portoseguro.mongoconnectspring.eventtype.service.EventTypeService;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeResponse;
import br.com.portoseguro.mongoconnectspring.eventtype.web.mapper.EventTypeMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class EventTypeControllerIT {

    @Mock
    private EventTypeService service;

    @Mock
    private EventTypeMapper mapper;

    @Mock
    private TraceCorrelation traceCorrelation;

    @InjectMocks
    private EventTypeController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiErrorHandler(traceCorrelation))
                .addFilters(new RequestPathFilter())
                .build();
    }

    @Test
    void shouldCreateEventType() throws Exception {
        UUID id = UUID.randomUUID();
        EventType eventType = new EventType();
        eventType.setId(id);
        EventTypeResponse response = new EventTypeResponse(id, "Evento", "Descricao", true, null, null);
        when(service.create(any())).thenReturn(eventType);
        when(mapper.toResponse(eq(eventType))).thenReturn(response);

        mockMvc.perform(post("/api/event-types")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(new Payload("Evento", "Descricao", true))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.name").value("Evento"));
    }

    @Test
    void shouldValidateEventTypePayload() throws Exception {
        mockMvc.perform(post("/api/event-types")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").exists());
    }

    private record Payload(String name, String description, Boolean active) {
    }
}