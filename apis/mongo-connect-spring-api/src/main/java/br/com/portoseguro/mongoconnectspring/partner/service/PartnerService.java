package br.com.portoseguro.mongoconnectspring.partner.service;

import br.com.portoseguro.mongoconnectspring.common.service.BaseCrudService;
import br.com.portoseguro.mongoconnectspring.common.service.BaseStatusService;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.repository.PartnerRepository;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerListRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerStatusRequest;
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
public class PartnerService implements BaseCrudService<Partner, PartnerListRequest, PartnerRequest, UUID>, BaseStatusService<Partner, PartnerStatusRequest, UUID> {

    private final PartnerRepository repository;

    public PartnerService(PartnerRepository repository) {
        this.repository = repository;
    }

    @Override
    @Cacheable(
            cacheNames = "partnerList",
            key = "#request.page + '|' + #request.size + '|' + #request.normalizedSortBy() + '|' + #request.normalizedDirection()",
            condition = "#request.normalizedSearch() == null && #request.page == 1 && #request.size <= 100"
    )
    public PageResponse<Partner> findAll(PartnerListRequest request) {
        String sortBy = request.normalizedSortBy();
        Sort.Direction direction = resolveDirection(request.normalizedDirection());
        String normalizedSearch = normalizeSearch(request.normalizedSearch());
        PageRequest pageable = PageRequest.of(request.getPage() - 1, request.getSize(), Sort.by(direction, sortBy));
        Page<Partner> page = repository.findAll(pageable, normalizedSearch);
        return new PageResponse<>(page.getContent(), request.getPage(), request.getSize(), page.getTotalElements(), page.getTotalPages(), page.hasNext(), page.hasPrevious());
    }

    @Override
    @Cacheable(cacheNames = "partnerById", key = "#id")
    public Partner findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "PARCEIRO nao encontrado."));
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "partnerById", key = "#result.id"), evict = @CacheEvict(cacheNames = "partnerList", allEntries = true))
    public Partner create(PartnerRequest request) {
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, null);
        return repository.save(buildNewPartner(request, normalizedName));
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "partnerById", key = "#id"), evict = @CacheEvict(cacheNames = "partnerList", allEntries = true))
    public Partner update(UUID id, PartnerRequest request) {
        Partner current = findExisting(id);
        String normalizedName = normalizeName(request.name());
        validateUniqueName(normalizedName, id);
        applyRequest(current, request, normalizedName);
        touch(current);
        return repository.save(current);
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "partnerById", key = "#id"), evict = @CacheEvict(cacheNames = "partnerList", allEntries = true))
    public Partner updateStatus(UUID id, PartnerStatusRequest request) {
        Partner current = findExisting(id);
        current.setActive(request.active());
        touch(current);
        return repository.save(current);
    }

    @Override
    @Caching(put = @CachePut(cacheNames = "partnerById", key = "#id"), evict = @CacheEvict(cacheNames = "partnerList", allEntries = true))
    public void delete(UUID id) {
        Partner current = findExisting(id);
        current.setDeleted(true);
        current.setActive(false);
        touch(current);
        repository.save(current);
    }

    private Partner buildNewPartner(PartnerRequest request, String normalizedName) {
        Instant now = Instant.now();
        Partner partner = new Partner();
        partner.setId(UUID.randomUUID());
        applyRequest(partner, request, normalizedName);
        partner.setDeleted(false);
        partner.setCreatedAt(now);
        partner.setUpdatedAt(now);
        return partner;
    }

    private void applyRequest(Partner partner, PartnerRequest request, String normalizedName) {
        partner.setName(normalizedName);
        partner.setDescription(normalizeDescription(request.description()));
        partner.setActive(resolveActive(request.active()));
    }

    private Partner findExisting(UUID id) {
        return findById(id);
    }

    private void validateUniqueName(String normalizedName, UUID currentId) {
        repository.findByNameIgnoreCase(normalizedName)
                .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe PARCEIRO com esse name.");
                });
    }

    private boolean resolveActive(Boolean active) {
        return active == null || active;
    }

    private void touch(Partner partner) {
        partner.setUpdatedAt(Instant.now());
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