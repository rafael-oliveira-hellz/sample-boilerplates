package br.com.portoseguro.mongoconnectspring.common.web.contract;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

public interface BaseCrudController<LIST_REQUEST, REQUEST, RESPONSE, ID> {

    @GetMapping
    PageResponse<RESPONSE> findAll(@Valid @ModelAttribute LIST_REQUEST request);

    @GetMapping("/{id}")
    RESPONSE findById(@PathVariable ID id);

    @PostMapping
    ResponseEntity<RESPONSE> create(@Valid @RequestBody REQUEST request);

    @PutMapping("/{id}")
    RESPONSE update(@PathVariable ID id, @Valid @RequestBody REQUEST request);

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable ID id);
}
