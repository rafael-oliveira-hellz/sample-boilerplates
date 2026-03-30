package br.com.portoseguro.mongoconnectspring.partner.web.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import br.com.portoseguro.mongoconnectspring.common.web.error.ApiErrorHandler;
import br.com.portoseguro.mongoconnectspring.common.web.filter.RequestPathFilter;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.service.PartnerService;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerResponse;
import br.com.portoseguro.mongoconnectspring.partner.web.mapper.PartnerMapper;
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
class PartnerControllerIT {

    @Mock
    private PartnerService service;

    @Mock
    private PartnerMapper mapper;

    @Mock
    private TraceCorrelation traceCorrelation;

    @InjectMocks
    private PartnerController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiErrorHandler(traceCorrelation))
                .addFilters(new RequestPathFilter())
                .build();
    }

    @Test
    void shouldUpdatePartnerStatus() throws Exception {
        UUID id = UUID.randomUUID();
        Partner partner = new Partner();
        partner.setId(id);
        partner.setActive(false);
        partner.setDeleted(false);
        when(service.updateStatus(org.mockito.ArgumentMatchers.eq(id), any())).thenReturn(partner);
        when(mapper.toResponse(partner)).thenReturn(new PartnerResponse(id, "Parceiro", "Descricao", false, false, null, null));

        mockMvc.perform(patch("/api/partners/{id}/active", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(new Payload(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.deleted").value(false));
    }

    private record Payload(Boolean active) {
    }
}