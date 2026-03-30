package br.com.portoseguro.mongoconnectspring.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.product.model.Product;
import br.com.portoseguro.mongoconnectspring.product.repository.ProductRepository;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductListRequest;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository repository;

    @InjectMocks
    private ProductService service;

    @Test
    void shouldCreateProductNormalizingFields() {
        when(repository.findByNameIgnoreCase("Seguro Residencial")).thenReturn(Optional.empty());
        when(repository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Product created = service.create(new ProductRequest("  Seguro   Residencial ", "  descricao   produto  "));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Seguro Residencial");
        assertThat(created.getDescription()).isEqualTo("descricao produto");
    }

    @Test
    void shouldRejectDuplicateProductName() {
        Product existing = new Product();
        existing.setId(UUID.randomUUID());
        when(repository.findByNameIgnoreCase("Seguro Residencial")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.create(new ProductRequest("Seguro Residencial", null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
    }

    @Test
    void shouldDeleteExistingProduct() {
        UUID id = UUID.randomUUID();
        Product product = new Product();
        product.setId(id);
        when(repository.findById(id)).thenReturn(Optional.of(product));

        service.delete(id);

        verify(repository).deleteById(id);
    }

    @Test
    void shouldReturnPagedProducts() {
        Product item = new Product();
        item.setId(UUID.randomUUID());
        item.setName("Produto");
        when(repository.findAll(any(Pageable.class), any())).thenReturn(new PageImpl<>(List.of(item)));
        ProductListRequest request = new ProductListRequest();
        request.setSearch("  residencial ");

        PageResponse<Product> response = service.findAll(request);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(pageableCaptor.capture(), org.mockito.ArgumentMatchers.eq("residencial"));
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(10);
        assertThat(response.items()).hasSize(1);
    }
}