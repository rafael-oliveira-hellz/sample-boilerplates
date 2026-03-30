package br.com.portoseguro.mongoconnectspring.common.repository;

import java.util.List;
import java.util.Optional;

public interface BaseCrudRepository<T, ID> {

    List<T> findAll();

    Optional<T> findById(ID id);

    T save(T entity);

    void deleteById(ID id);
}
