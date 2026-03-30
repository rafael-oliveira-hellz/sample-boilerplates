package br.com.portoseguro.mongoconnectspring.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;
import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
import br.com.portoseguro.mongoconnectspring.partner.repository.PartnerRepository;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerListRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerRequest;
import br.com.portoseguro.mongoconnectspring.partner.web.dto.PartnerStatusRequest;
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
class PartnerServiceTest {

    @Mock
    private PartnerRepository repository;

    @InjectMocks
    private PartnerService service;

    @Test
    void shouldCreatePartnerWithSoftDeleteFlagDisabled() {
        when(repository.findByNameIgnoreCase("Oficina Credenciada")).thenReturn(Optional.empty());
        when(repository.save(any(Partner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Partner created = service.create(new PartnerRequest("  Oficina  Credenciada ", "  descricao  parceira ", null));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Oficina Credenciada");
        assertThat(created.getDescription()).isEqualTo("descricao parceira");
        assertThat(created.getActive()).isTrue();
        assertThat(created.getDeleted()).isFalse();
    }

    @Test
    void shouldRejectDuplicatePartnerName() {
        Partner existing = new Partner();
        existing.setId(UUID.randomUUID());
        when(repository.findByNameIgnoreCase("Oficina Credenciada")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.create(new PartnerRequest("Oficina Credenciada", null, true)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
    }

    @Test
    void shouldSoftDeletePartner() {
        UUID id = UUID.randomUUID();
        Partner existing = new Partner();
        existing.setId(id);
        existing.setActive(true);
        existing.setDeleted(false);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Partner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.delete(id);

        assertThat(existing.getDeleted()).isTrue();
        assertThat(existing.getActive()).isFalse();
        verify(repository).save(existing);
    }

    @Test
    void shouldUpdatePartnerStatus() {
        UUID id = UUID.randomUUID();
        Partner existing = new Partner();
        existing.setId(id);
        existing.setActive(true);
        existing.setDeleted(false);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Partner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Partner updated = service.updateStatus(id, new PartnerStatusRequest(false));

        assertThat(updated.getActive()).isFalse();
    }

    @Test
    void shouldReturnPagedPartners() {
        Partner item = new Partner();
        item.setId(UUID.randomUUID());
        item.setName("Parceiro");
        when(repository.findAll(any(Pageable.class), any())).thenReturn(new PageImpl<>(List.of(item)));
        PartnerListRequest request = new PartnerListRequest();
        request.setSearch("  oficina  ");

        PageResponse<Partner> response = service.findAll(request);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(pageableCaptor.capture(), org.mockito.ArgumentMatchers.eq("oficina"));
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(response.items()).hasSize(1);
    }
}