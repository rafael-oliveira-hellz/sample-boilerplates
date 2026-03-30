package br.com.portoseguro.mongoconnectspring.product.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductListRequestTest {

    @Test
    void shouldNormalizeCustomValues() {
        ProductListRequest request = new ProductListRequest();
        request.setSortBy("updatedAt");
        request.setDirection("ASC");
        request.setSearch("  casa  ");

        assertThat(request.normalizedSortBy()).isEqualTo("updatedAt");
        assertThat(request.normalizedDirection()).isEqualTo("asc");
        assertThat(request.normalizedSearch()).isEqualTo("casa");
    }
}