package br.com.portoseguro.mongoconnectspring.eventtype.service;

import br.com.portoseguro.mongoconnectspring.common.service.BaseCrudService;
import br.com.portoseguro.mongoconnectspring.common.service.BaseStatusService;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import br.com.portoseguro.mongoconnectspring.eventtype.repository.EventTypeRepository;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeListRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeStatusRequest;
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
public class EventTypeService implements
        BaseCrudService<EventType, EventTypeListRequest, EventTypeRequest, UUID>,
        BaseStatusService<EventType, EventTypeStatusRequest, UUID> {

    private final EventTypeRepository repository;

    public EventTypeService(EventTypeRepository repository) {
        this.repository = repository;
    }

    @Override
    @Cacheable(
            cacheNames = "eventTypeList",
            key = "#request.page + '|' + #request.size + '|' + #request.normalizedSortBy() + '|' + #request.normalizedDirection()",
            condition = "#request.normalizedSearch() == null && #request.page == 1 && #request.size <= 100"
    )
    public PageResponse<EventType> findAll(EventTypeListRequest request) {
        String sortBy = request.normalizedSortBy();
        Sort.Direction direction = resolveDirection(request.normalizedDirection());
        String normalizedSearch = normalizeSearch(request.normalizedSearch());
        PageRequest pageable = PageRequest.of(request.getPage() - 1, request.getSize(), Sort.by(direction, sortBy));
        Page<EventType> page = repository.findAll(pageable, normalizedSearch);
        return new PageResponse<>(
                page.getContent(),
                request.getPage(),
                request.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
    }

    @Override
    @Cacheable(cacheNames = "eventTypeById", key = "#id")
    public EventType findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EVENT_TYPE nao encontrado."));
    }

    @Override
    @Caching(
            put = @CachePut(cacheNames = "eventTypeById", key = "#result.id"),
            evict = @CacheEvict(cacheNames = "eventTypeList", allEntries = true)
    )
    public EventType create(EventTypeRequest request) {
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, null);
        return repository.save(buildNewEventType(request, normalizedName));
    }

    @Override
    @Caching(
            put = @CachePut(cacheNames = "eventTypeById", key = "#id"),
            evict = @CacheEvict(cacheNames = "eventTypeList", allEntries = true)
    )
    public EventType update(UUID id, EventTypeRequest request) {
        EventType current = findExisting(id);
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, id);
        applyRequest(current, request, normalizedName);
        touch(current);
        return repository.save(current);
    }

    @Override
    @Caching(
            put = @CachePut(cacheNames = "eventTypeById", key = "#id"),
            evict = @CacheEvict(cacheNames = "eventTypeList", allEntries = true)
    )
    public EventType updateStatus(UUID id, EventTypeStatusRequest request) {
        EventType current = findExisting(id);
        current.setActive(request.active());
        touch(current);
        return repository.save(current);
    }

    @Override
    @Caching(evict = {
            @CacheEvict(cacheNames = "eventTypeById", key = "#id"),
            @CacheEvict(cacheNames = "eventTypeList", allEntries = true)
    })
    public void delete(UUID id) {
        repository.deleteById(findExisting(id).getId());
    }

    private EventType buildNewEventType(EventTypeRequest request, String normalizedName) {
        Instant now = Instant.now();
        EventType eventType = new EventType();
        eventType.setId(UUID.randomUUID());
        applyRequest(eventType, request, normalizedName);
        eventType.setCreatedAt(now);
        eventType.setUpdatedAt(now);
        return eventType;
    }

    private void applyRequest(EventType eventType, EventTypeRequest request, String normalizedName) {
        eventType.setName(normalizedName);
        eventType.setDescription(normalizeDescription(request.description()));
        eventType.setActive(resolveActive(request.active()));
    }

    private EventType findExisting(UUID id) {
        return findById(id);
    }

    private void validateUniqueName(String normalizedName, UUID currentId) {
        repository.findByNameIgnoreCase(normalizedName)
                .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe EVENT_TYPE com esse name.");
                });
    }

    private boolean resolveActive(Boolean active) {
        return active == null || active;
    }

    private void touch(EventType eventType) {
        eventType.setUpdatedAt(Instant.now());
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
