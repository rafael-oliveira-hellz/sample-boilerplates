package com.example.mapperapi.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public class ConfigStorageService {

  private final ObjectMapper objectMapper;
  private final Path storagePath;

  public ConfigStorageService(
      ObjectMapper objectMapper,
      @Value("${app.storage-path:data/configs}") String storagePath
  ) {
    this.objectMapper = objectMapper;
    this.storagePath = Path.of(storagePath);
  }

  public ObjectNode save(JsonNode config) {
    try {
      Files.createDirectories(storagePath);
      ObjectNode document = validateAndNormalizeConfig(config);

      String id = UUID.randomUUID().toString();
      String savedAt = OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
      String fileName = savedAt.replace(":", "-") + "-" + id + ".json";

      document.put("id", id);

      objectMapper.writerWithDefaultPrettyPrinter().writeValue(storagePath.resolve(fileName).toFile(), document);
      return document;
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao salvar configuracao.", exception);
    }
  }

  public ObjectNode findLatest() {
    return findLatest(null, null, null, null);
  }

  public ObjectNode findLatest(
      String nomeParceiro,
      String eventoParceiro,
      String tipoSchema,
      String versaoSchema
  ) {
    try {
      Files.createDirectories(storagePath);

      try (Stream<Path> paths = Files.list(storagePath)) {
        Path latestFile = paths
            .filter(path -> path.getFileName().toString().endsWith(".json"))
            .filter(path -> {
                try {
                    return matchesFilters(path, nomeParceiro, eventoParceiro, tipoSchema, versaoSchema);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            })
            .max(Comparator.comparingLong(this::safeLastModified))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nenhuma configuracao salva."));

        JsonNode payload = objectMapper.readTree(latestFile.toFile());
        return normalizeStoredDocument(payload);
      }
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha ao ler configuracao.", exception);
    }
  }

  private long safeLastModified(Path path) {
    try {
      return Files.getLastModifiedTime(path).toMillis();
    } catch (IOException exception) {
      return Long.MIN_VALUE;
    }
  }

  private ObjectNode validateAndNormalizeConfig(JsonNode config) {
    if (config == null || !config.isObject()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O documento da configuracao deve ser um objeto JSON.");
    }

    JsonNode document = extractPersistenceDocument(config);
    requireText(document, "nome_parceiro");
    requireText(document, "evento_parceiro");
    requireText(document, "tipo_schema");
    requireText(document, "versao_schema");
    requireObject(document, "schema_origem");
    requireObject(document, "schema_destino");

    if (document instanceof ObjectNode objectNode) {
      return objectNode.deepCopy();
    }

    return objectMapper.createObjectNode();
  }

  private void requireText(JsonNode node, String fieldName) {
    JsonNode field = node.path(fieldName);
    if (!field.isString() || field.asString().isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Campo obrigatorio ausente ou invalido: " + fieldName + "."
      );
    }
  }

  private void requireObject(JsonNode node, String fieldName) {
    JsonNode field = node.path(fieldName);
    if (!field.isObject()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Campo obrigatorio ausente ou invalido: " + fieldName + "."
      );
    }
  }

  private boolean matchesFilters(
      Path path,
      String nomeParceiro,
      String eventoParceiro,
      String tipoSchema,
      String versaoSchema
  ) throws IOException {
    if (isBlank(nomeParceiro) && isBlank(eventoParceiro) && isBlank(tipoSchema) && isBlank(versaoSchema)) {
      return true;
    }

      JsonNode payload = objectMapper.readTree(path.toFile());
      JsonNode document = extractPersistenceDocument(payload);
      return matchesField(document, "nome_parceiro", nomeParceiro)
          && matchesField(document, "evento_parceiro", eventoParceiro)
          && matchesField(document, "tipo_schema", tipoSchema)
          && matchesField(document, "versao_schema", versaoSchema);
  }

  private boolean matchesField(JsonNode document, String fieldName, String expectedValue) {
    if (isBlank(expectedValue)) {
      return true;
    }

    return expectedValue.equals(document.path(fieldName).asString());
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private JsonNode extractPersistenceDocument(JsonNode config) {
    if (config == null || config.isMissingNode() || config.isNull()) {
      return objectMapper.createObjectNode();
    }

    if (looksLikePersistenceDocument(config)) {
      return config;
    }

    JsonNode configEnvelope = config.path("config");
    if (looksLikePersistenceDocument(configEnvelope)) {
      return configEnvelope;
    }

    JsonNode persistenceDocument = config.path("persistenceDocument");
    if (persistenceDocument.isObject()) {
      return persistenceDocument;
    }

    return objectMapper.createObjectNode();
  }

  private ObjectNode normalizeStoredDocument(JsonNode payload) {
    JsonNode document = extractPersistenceDocument(payload);
    ObjectNode normalized = document instanceof ObjectNode objectNode
        ? objectNode.deepCopy()
        : objectMapper.createObjectNode();

    if (!normalized.has("id")) {
      String id = payload.path("id").asString(null);
      if (id != null && !id.isBlank()) {
        normalized.put("id", id);
      }
    }

    return normalized;
  }

  private boolean looksLikePersistenceDocument(JsonNode node) {
    return node.has("nome_parceiro")
        && node.has("evento_parceiro")
        && node.has("tipo_schema")
        && node.has("versao_schema")
        && node.has("schema_origem")
        && node.has("schema_destino");
  }
}
