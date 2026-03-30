package br.com.portoseguro.mongoconnectspring.eventtype.repository;

import br.com.portoseguro.mongoconnectspring.common.repository.BaseCrudRepository;
import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface EventTypeRepository extends BaseCrudRepository<EventType, UUID> {

    Page<EventType> findAll(Pageable pageable, String search);

    Optional<EventType> findByName(String name);

    Optional<EventType> findByNameIgnoreCase(String name);
}
