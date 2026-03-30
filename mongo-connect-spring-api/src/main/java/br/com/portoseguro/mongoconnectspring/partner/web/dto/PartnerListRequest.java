package br.com.portoseguro.mongoconnectspring.partner.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class PartnerListRequest {

    @Min(value = 1, message = "[page] deve ser maior ou igual a 1")
    private int page = 1;
    @Min(value = 1, message = "[size] deve ser maior ou igual a 1")
    @Max(value = 100, message = "[size] deve ser menor ou igual a 100")
    private int size = 10;
    @Size(max = 100, message = "[search] deve ter no maximo 100 caracteres")
    private String search;
    @Pattern(regexp = "name|createdAt|updatedAt|active", message = "[sortBy] deve ser um destes valores: name, createdAt, updatedAt, active")
    private String sortBy = "name";
    private String direction = "desc";

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }
    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }
    public String getSearch() { return search; }
    public void setSearch(String search) { this.search = search; }
    public String getSortBy() { return sortBy; }
    public void setSortBy(String sortBy) { this.sortBy = sortBy; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public String normalizedSearch() { return search == null ? null : search.trim(); }
    public String normalizedSortBy() { return sortBy == null || sortBy.isBlank() ? "name" : sortBy.trim(); }
    public String normalizedDirection() { return direction == null || direction.isBlank() ? "desc" : direction.trim().toLowerCase(); }
}