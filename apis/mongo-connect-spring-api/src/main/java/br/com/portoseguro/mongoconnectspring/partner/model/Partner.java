package br.com.portoseguro.mongoconnectspring.partner.model;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "PARCEIRO")
@CompoundIndex(name = "partner_name_deleted_uq", def = "{ 'nome': 1, 'is_deleted': 1 }", unique = true)
public class Partner {

    @Id
    private UUID id;

    @Field("nome")
    private String name;

    @Field("descricao")
    private String description;

    @Field("ativo")
    private Boolean active;

    @Field("is_deleted")
    private Boolean deleted;

    @Field("criado_em")
    private Instant createdAt;

    @Field("atualizado_em")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Boolean getDeleted() { return deleted; }
    public void setDeleted(Boolean deleted) { this.deleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}