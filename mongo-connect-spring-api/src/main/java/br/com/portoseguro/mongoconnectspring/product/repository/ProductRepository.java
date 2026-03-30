package br.com.portoseguro.mongoconnectspring.product.repository;

import br.com.portoseguro.mongoconnectspring.common.repository.BaseCrudRepository;
import br.com.portoseguro.mongoconnectspring.product.model.Product;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProductRepository extends BaseCrudRepository<Product, UUID> {

    Page<Product> findAll(Pageable pageable, String search);

    Optional<Product> findByNameIgnoreCase(String name);
}