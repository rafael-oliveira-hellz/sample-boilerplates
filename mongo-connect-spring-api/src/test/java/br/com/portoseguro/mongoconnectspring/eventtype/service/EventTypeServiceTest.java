package br.com.portoseguro.mongoconnectspring.eventtype.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import br.com.portoseguro.mongoconnectspring.eventtype.repository.EventTypeRepository;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeListRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeRequest;
import br.com.portoseguro.mongoconnectspring.eventtype.web.dto.EventTypeStatusRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class EventTypeServiceTest {

    @Mock
    private EventTypeRepository repository;

    @InjectMocks
    private EventTypeService service;

    @Test
    void shouldCreateEventTypeNormalizingFields() {
        when(repository.findByNameIgnoreCase("Sinistro Auto")).thenReturn(Optional.empty());
        when(repository.save(any(EventType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EventType created = service.create(new EventTypeRequest("  Sinistro   Auto  ", "  descricao   teste  ", null));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Sinistro Auto");
        assertThat(created.getDescription()).isEqualTo("descricao teste");
        assertThat(created.getActive()).isTrue();
        assertThat(created.getCreatedAt()).isNotNull();
        assertThat(created.getUpdatedAt()).isNotNull();
    }

    @Test
    void shouldRejectDuplicateNameOnCreate() {
        EventType existing = new EventType();
        existing.setId(UUID.randomUUID());
        when(repository.findByNameIgnoreCase("Sinistro Auto")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.create(new EventTypeRequest("Sinistro Auto", null, true)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
    }

    @Test
    void shouldUpdateStatus() {
        UUID id = UUID.randomUUID();
        EventType existing = new EventType();
        existing.setId(id);
        existing.setName("Atual");
        existing.setActive(true);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(EventType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EventType updated = service.updateStatus(id, new EventTypeStatusRequest(false));

        assertThat(updated.getActive()).isFalse();
        assertThat(updated.getUpdatedAt()).isNotNull();
    }

    @Test
    void shouldReturnPagedList() {
        EventType item = new EventType();
        item.setId(UUID.randomUUID());
        item.setName("Evento");
        when(repository.findAll(any(Pageable.class), any())).thenReturn(new PageImpl<>(List.of(item)));
        EventTypeListRequest request = new EventTypeListRequest();
        request.setPage(1);
        request.setSize(10);
        request.setSearch("  auto  ");

        PageResponse<EventType> response = service.findAll(request);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(pageableCaptor.capture(), org.mockito.ArgumentMatchers.eq("auto"));
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(response.items()).hasSize(1);
        assertThat(response.page()).isEqualTo(1);
    }
}