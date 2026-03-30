package br.com.portoseguro.mongoconnectspring.common.service;

import br.com.portoseguro.mongoconnectspring.common.web.contract.PageResponse;

public interface BaseCrudService<T, LIST_REQUEST, REQUEST, ID> {

    PageResponse<T> findAll(LIST_REQUEST request);

    T findById(ID id);

    T create(REQUEST request);

    T update(ID id, REQUEST request);

    void delete(ID id);
}
