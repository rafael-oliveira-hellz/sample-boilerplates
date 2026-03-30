package br.com.portoseguro.mongoconnectspring.product.service;

import br.com.portoseguro.mongoconnectspring.common.service.BaseCrudService;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.product.model.Product;
import br.com.portoseguro.mongoconnectspring.product.repository.ProductRepository;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductListRequest;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductRequest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductService implements BaseCrudService<Product, ProductListRequest, ProductRequest, UUID> {

    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    @Override
    @Cacheable(
            cacheNames = "productList",
            key = "#request.page + '|' + #request.size + '|' + #request.normalizedSortBy() + '|' + #request.normalizedDirection()",
            condition = "#request.normalizedSearch() == null && #request.page == 1 && #request.size <= 100"
    )
    public PageResponse<Product> findAll(ProductListRequest request) {
        String sortBy = request.normalizedSortBy();
        Sort.Direction direction = resolveDirection(request.normalizedDirection());
        String normalizedSearch = normalizeSearch(request.normalizedSearch());
        PageRequest pageable = PageRequest.of(request.getPage() - 1, request.getSize(), Sort.by(direction, sortBy));
        Page<Product> page = repository.findAll(pageable, normalizedSearch);
        return new PageResponse<>(page.getContent(), request.getPage(), request.getSize(), page.getTotalElements(), page.getTotalPages(), page.hasNext(), page.hasPrevious());
    }

    @Override
    @Cacheable(cacheNames = "productById", key = "#id")
    public Product findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PRODUTO nao encontrado."));
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "productById", key = "#result.id"), evict = @CacheEvict(cacheNames = "productList", allEntries = true))
    public Product create(ProductRequest request) {
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, null);
        return repository.save(buildNewProduct(request, normalizedName));
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "productById", key = "#id"), evict = @CacheEvict(cacheNames = "productList", allEntries = true))
    public Product update(UUID id, ProductRequest request) {
        Product current = findExisting(id);
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, id);
        applyRequest(current, request, normalizedName);
        touch(current);
        return repository.save(current);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = "productById", key = "#id"),
            @CacheEvict(cacheNames = "productList", allEntries = true)
    })
    public void delete(UUID id) {
        repository.deleteById(findExisting(id).getId());
    }

    private Product buildNewProduct(ProductRequest request, String normalizedName) {
        Instant now = Instant.now();
        Product product = new Product();
        product.setId(UUID.randomUUID());
        applyRequest(product, request, normalizedName);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        return product;
    }

    private void applyRequest(Product product, ProductRequest request, String normalizedName) {
        product.setName(normalizedName);
        product.setDescription(normalizeDescription(request.description()));
    }

    private Product findExisting(UUID id) {
        return findById(id);
    }

    private void validateUniqueName(String normalizedName, UUID currentId) {
        repository.findByNameIgnoreCase(normalizedName)
                .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe PRODUTO com esse name.");
                });
    }

    private void touch(Product product) {
        product.setUpdatedAt(Instant.now());
    }

    private Sort.Direction resolveDirection(String direction) {
        return "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
    }

    private String normalizeName(String name) {
        return name.trim().replaceAll("\\s+", " ");
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String normalized = description.trim().replaceAll("\\s+", " ");
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeSearch(String search) {
        if (search == null) {
            return null;
        }
        String normalized = search.trim().replaceAll("\\s+", " ");
        return normalized.isBlank() ? null : normalized;
    }
}