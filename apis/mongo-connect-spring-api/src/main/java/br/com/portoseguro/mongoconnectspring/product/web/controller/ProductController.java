package br.com.portoseguro.mongoconnectspring.product.web.controller;

import br.com.portoseguro.mongoconnectspring.common.web.contract.BaseCrudController;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.product.model.Product;
import br.com.portoseguro.mongoconnectspring.product.service.ProductService;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductListRequest;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductRequest;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductResponse;
import br.com.portoseguro.mongoconnectspring.product.web.mapper.ProductMapper;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController implements BaseCrudController<ProductListRequest, ProductRequest, ProductResponse, UUID> {

    private final ProductService service;
    private final ProductMapper mapper;

    public ProductController(ProductService service, ProductMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @Override
    public PageResponse<ProductResponse> findAll(ProductListRequest request) {
        PageResponse<Product> page = service.findAll(request);
        return new PageResponse<>(page.items().stream().map(mapper::toResponse).toList(), page.page(), page.size(), page.totalItems(), page.totalPages(), page.hasNext(), page.hasPrevious());
    }

    @Override
    public ProductResponse findById(UUID id) {
        return mapper.toResponse(service.findById(id));
    }

    @Override
    public ResponseEntity<ProductResponse> create(ProductRequest request) {
        ProductResponse response = mapper.toResponse(service.create(request));
        return ResponseEntity.created(URI.create("/api/products/" + response.id())).body(response);
    }

    @Override
    public ProductResponse update(UUID id, ProductRequest request) {
        return mapper.toResponse(service.update(id, request));
    }

    @Override
    public ResponseEntity<Void> delete(UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}