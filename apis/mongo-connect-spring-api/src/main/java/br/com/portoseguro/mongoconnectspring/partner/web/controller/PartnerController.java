package br.com.portoseguro.mongoconnectspring.partner.web.controller;

import br.com.portoseguro.mongoconnectspring.common.web.contract.BaseCrudController;
import br.com.portoseguro.mongoconnectspring.common.web.contract.BaseStatusController;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.service.PartnerService;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerListRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerResponse;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerStatusRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.mapper.PartnerMapper;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/partners")
public class PartnerController implements BaseCrudController<PartnerListRequest, PartnerRequest, PartnerResponse, UUID>, BaseStatusController<PartnerStatusRequest, PartnerResponse, UUID> {

    private final PartnerService service;
    private final PartnerMapper mapper;

    public PartnerController(PartnerService service, PartnerMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @Override
    public PageResponse<PartnerResponse> findAll(PartnerListRequest request) {
        PageResponse<Partner> page = service.findAll(request);
        return new PageResponse<>(page.items().stream().map(mapper::toResponse).toList(), page.page(), page.size(), page.totalItems(), page.totalPages(), page.hasNext(), page.hasPrevious());
    }

    @Override
    public PartnerResponse findById(UUID id) {
        return mapper.toResponse(service.findById(id));
    }

    @Override
    public ResponseEntity<PartnerResponse> create(PartnerRequest request) {
        PartnerResponse response = mapper.toResponse(service.create(request));
        return ResponseEntity.created(URI.create("/api/partners/" + response.id())).body(response);
    }

    @Override
    public PartnerResponse update(UUID id, PartnerRequest request) {
        return mapper.toResponse(service.update(id, request));
    }

    @Override
    public PartnerResponse updateStatus(UUID id, PartnerStatusRequest request) {
        return mapper.toResponse(service.updateStatus(id, request));
    }

    @Override
    public ResponseEntity<Void> delete(UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}