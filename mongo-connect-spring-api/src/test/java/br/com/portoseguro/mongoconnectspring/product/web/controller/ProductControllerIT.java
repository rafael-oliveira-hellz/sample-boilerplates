package br.com.portoseguro.mongoconnectspring.product.web.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import br.com.portoseguro.mongoconnectspring.common.web.error.ApiErrorHandler;
import br.com.portoseguro.mongoconnectspring.common.web.filter.RequestPathFilter;
import br.com.portoseguro.mongoconnectspring.product.model.Product;
import br.com.portoseguro.mongoconnectspring.product.service.ProductService;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductResponse;
import br.com.portoseguro.mongoconnectspring.product.web.mapper.ProductMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ProductControllerIT {

    @Mock
    private ProductService service;

    @Mock
    private ProductMapper mapper;

    @Mock
    private TraceCorrelation traceCorrelation;

    @InjectMocks
    private ProductController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiErrorHandler(traceCorrelation))
                .addFilters(new RequestPathFilter())
                .build();
    }

    @Test
    void shouldReturnProductById() throws Exception {
        UUID id = UUID.randomUUID();
        Product product = new Product();
        product.setId(id);
        when(service.findById(id)).thenReturn(product);
        when(mapper.toResponse(product)).thenReturn(new ProductResponse(id, "Produto", "Descricao", null, null));

        mockMvc.perform(get("/api/products/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.name").value("Produto"));
    }
}