package br.com.portoseguro.mongoconnectspring.partner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import br.com.portoseguro.mongoconnectspring.common.web.error.ApiErrorHandler;
import br.com.portoseguro.mongoconnectspring.common.web.filter.RequestPathFilter;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.repository.PartnerRepository;
import br.com.portoseguro.mongoconnectspring.partner.service.PartnerService;
import br.com.portoseguro.mongoconnectspring.partner.web.controller.PartnerController;
import br.com.portoseguro.mongoconnectspring.partner.web.mapper.PartnerMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(classes = PartnerApiE2ETest.TestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class PartnerApiE2ETest {

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({PartnerController.class, PartnerService.class, PartnerMapper.class, ApiErrorHandler.class, TraceCorrelation.class, RequestPathFilter.class})
    static class TestApplication {
    }

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private PartnerRepository repository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void shouldCreatePartnerEndToEnd() throws Exception {
        when(repository.findByNameIgnoreCase("Parceiro Bronze")).thenReturn(java.util.Optional.empty());
        when(repository.save(any(Partner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MvcResult result = mockMvc.perform(post("/api/partners")
                        .contentType("application/json")
                        .content("{\"name\":\"Parceiro Bronze\",\"description\":\"Descricao\",\"active\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Parceiro Bronze"))
                .andExpect(jsonPath("$.deleted").value(false))
                .andReturn();

        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("Parceiro Bronze");
    }
}