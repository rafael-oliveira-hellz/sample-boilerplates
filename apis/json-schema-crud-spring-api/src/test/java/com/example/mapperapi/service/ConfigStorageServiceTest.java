package com.example.mapperapi.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class ConfigStorageServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @TempDir
  Path tempDir;

  @Test
  void shouldSaveAndLoadLatestConfig() {
    ConfigStorageService service = new ConfigStorageService(objectMapper, tempDir.toString());
    JsonNode config = validConfig("porto", "emissao", "destino", "v1");

    ObjectNode saved = service.save(config);
    ObjectNode latest = service.findLatest();

    assertNotNull(saved.path("id").asString());
    assertEquals(saved.path("id").asString(), latest.path("id").asString());
    assertEquals("porto", latest.path("nome_parceiro").asString());
  }

  @Test
  void shouldThrowWhenNoConfigExists() {
    ConfigStorageService service = new ConfigStorageService(objectMapper, tempDir.toString());

    assertThrows(ResponseStatusException.class, service::findLatest);
  }

  @Test
  void shouldReturnLatestConfigUsingMetadataFilters() {
    ConfigStorageService service = new ConfigStorageService(objectMapper, tempDir.toString());
    service.save(validConfig("porto", "emissao", "destino", "v1"));
    service.save(validConfig("porto", "cotacao", "destino", "v2"));

    ObjectNode latest = service.findLatest("porto", "cotacao", "destino", "v2");

    assertEquals("cotacao", latest.path("evento_parceiro").asString());
    assertEquals("v2", latest.path("versao_schema").asString());
  }

  @Test
  void shouldValidateRequiredFieldsBeforeSaving() {
    ConfigStorageService service = new ConfigStorageService(objectMapper, tempDir.toString());
    JsonNode invalid = objectMapper.createObjectNode().put("nome_parceiro", "porto");

    assertThrows(ResponseStatusException.class, () -> service.save(invalid));
  }

  @Test
  void shouldAcceptFrontendV2EnvelopeByValidatingPersistenceDocument() {
    ConfigStorageService service = new ConfigStorageService(objectMapper, tempDir.toString());
    ObjectNode config = objectMapper.createObjectNode();
    config.put("version", "v2");
    config.set("persistenceDocument", validConfig("porto", "emissao", "destino", "v1"));

    ObjectNode saved = service.save(config);

    assertEquals("porto", saved.path("nome_parceiro").asString());
    assertEquals("v1", saved.path("versao_schema").asString());
  }

  private JsonNode validConfig(String parceiro, String evento, String tipoSchema, String versaoSchema) {
    return objectMapper.createObjectNode()
        .put("nome_parceiro", parceiro)
        .put("evento_parceiro", evento)
        .put("tipo_schema", tipoSchema)
        .put("versao_schema", versaoSchema)
        .set("schema_origem", objectMapper.createObjectNode().put("type", "object"))
        .set("schema_destino", objectMapper.createObjectNode().put("type", "object"));
  }
}
