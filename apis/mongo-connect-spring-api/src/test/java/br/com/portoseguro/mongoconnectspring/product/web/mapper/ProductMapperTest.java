package br.com.portoseguro.mongoconnectspring.product.web.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.portoseguro.mongoconnectspring.product.model.Product;
import org.junit.jupiter.api.Test;

class ProductMapperTest {

    private final ProductMapper mapper = new ProductMapper();

    @Test
    void shouldMapProductToResponse() {
        Product product = new Product();
        product.setName("Produto");
        product.setDescription("Descricao");

        assertThat(mapper.toResponse(product).name()).isEqualTo("Produto");
        assertThat(mapper.toResponse(product).description()).isEqualTo("Descricao");
    }
}