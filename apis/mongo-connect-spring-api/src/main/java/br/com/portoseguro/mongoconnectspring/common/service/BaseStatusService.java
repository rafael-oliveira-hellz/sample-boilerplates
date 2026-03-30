package br.com.portoseguro.mongoconnectspring.common.service;

public interface BaseStatusService<T, STATUS_REQUEST, ID> {

    T updateStatus(ID id, STATUS_REQUEST request);
}
