package br.com.portoseguro.mongoconnectspring.eventtype.web.controller;

import br.com.portoseguro.mongoconnectspring.common.web.contract.BaseCrudController;
import br.com.portoseguro.mongoconnectspring.common.web.contract.BaseStatusController;
import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import br.com.portoseguro.mongoconnectspring.eventtype.service.EventTypeService;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeListRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeResponse;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeStatusRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.mapper.EventTypeMapper;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/event-types")
public class EventTypeController implements
        BaseCrudController<EventTypeListRequest, EventTypeRequest, EventTypeResponse, UUID>,
        BaseStatusController<EventTypeStatusRequest, EventTypeResponse, UUID> {

    private final EventTypeService service;
    private final EventTypeMapper mapper;

    public EventTypeController(EventTypeService service, EventTypeMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @Override
    public PageResponse<EventTypeResponse> findAll(EventTypeListRequest request) {
        PageResponse<EventType> page = service.findAll(request);
        return new PageResponse<>(
                page.items().stream().map(mapper::toResponse).toList(),
                page.page(),
                page.size(),
                page.totalItems(),
                page.totalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
    }

    @Override
    public EventTypeResponse findById(UUID id) {
        return mapper.toResponse(service.findById(id));
    }

    @Override
    public ResponseEntity<EventTypeResponse> create(EventTypeRequest request) {
        EventTypeResponse response = mapper.toResponse(service.create(request));
        return ResponseEntity.created(URI.create("/api/event-types/" + response.id())).body(response);
    }

    @Override
    public EventTypeResponse update(UUID id, EventTypeRequest request) {
        return mapper.toResponse(service.update(id, request));
    }

    @Override
    public EventTypeResponse updateStatus(UUID id, EventTypeStatusRequest request) {
        return mapper.toResponse(service.updateStatus(id, request));
    }

    @Override
    public ResponseEntity<Void> delete(UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
