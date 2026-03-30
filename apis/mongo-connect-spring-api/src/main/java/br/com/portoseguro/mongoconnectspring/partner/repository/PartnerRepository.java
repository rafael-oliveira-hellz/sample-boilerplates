package br.com.portoseguro.mongoconnectspring.partner.repository;

import br.com.portoseguro.mongoconnectspring.common.repository.BaseCrudRepository;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PartnerRepository extends BaseCrudRepository<Partner, UUID> {

    Page<Partner> findAll(Pageable pageable, String search);

    Optional<Partner> findByNameIgnoreCase(String name);
}