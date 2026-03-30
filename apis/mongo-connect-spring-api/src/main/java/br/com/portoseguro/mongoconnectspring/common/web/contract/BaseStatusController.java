package br.com.portoseguro.mongoconnectspring.common.web.contract;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

public interface BaseStatusController<STATUS_REQUEST, RESPONSE, ID> {

    @PatchMapping("/{id}/active")
    RESPONSE updateStatus(@PathVariable ID id, @Valid @RequestBody STATUS_REQUEST request);
}
