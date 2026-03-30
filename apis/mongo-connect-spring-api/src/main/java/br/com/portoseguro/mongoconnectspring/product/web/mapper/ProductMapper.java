package br.com.portoseguro.mongoconnectspring.product.web.mapper;

import br.com.portoseguro.mongoconnectspring.product.model.Product;
import br.com.portoseguro.mongoconnectspring.product.web.dto.ProductResponse;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getDescription(), product.getCreatedAt(), product.getUpdatedAt());
    }
}