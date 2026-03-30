package com.example.mapperapi.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ConfigControllerIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @TempDir
  static java.nio.file.Path tempDir;

  @DynamicPropertySource
  static void registerProps(DynamicPropertyRegistry registry) {
    registry.add("app.storage-path", () -> tempDir.toString());
  }

  @Test
  void shouldSaveConfig() throws Exception {
    mockMvc.perform(post("/api/configs")
            .contentType("application/json")
            .content("""
                {
                  "nome_parceiro": "porto_teste_1",
                  "evento_parceiro": "emissao",
                  "tipo_schema": "destino",
                  "versao_schema": "v1",
                  "schema_origem": { "type": "object" },
                  "schema_destino": { "type": "object" }
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.nome_parceiro").value("porto_teste_1"));
  }

  @Test
  void shouldReturnLatestConfig() throws Exception {
    mockMvc.perform(post("/api/configs")
            .contentType("application/json")
            .content("""
                {
                  "nome_parceiro": "porto_teste_1",
                  "evento_parceiro": "emissao",
                  "tipo_schema": "destino",
                  "versao_schema": "v1",
                  "schema_origem": { "type": "object" },
                  "schema_destino": { "type": "object" }
                }
                """))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/configs/latest"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.tipo_schema").value("destino"));
  }

  @Test
  void shouldReturnLatestConfigByMetadataFilters() throws Exception {
    mockMvc.perform(post("/api/configs")
            .contentType("application/json")
            .content("""
                {
                  "nome_parceiro": "porto_teste_1",
                  "evento_parceiro": "emissao",
                  "tipo_schema": "destino",
                  "versao_schema": "v1",
                  "schema_origem": { "type": "object" },
                  "schema_destino": { "type": "object" }
                }
                """))
        .andExpect(status().isOk());

    mockMvc.perform(post("/api/configs")
            .contentType("application/json")
            .content("""
                {
                  "nome_parceiro": "porto_teste_1",
                  "evento_parceiro": "cotacao",
                  "tipo_schema": "destino",
                  "versao_schema": "v2",
                  "schema_origem": { "type": "object" },
                  "schema_destino": { "type": "object" }
                }
                """))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/configs/latest")
            .param("nome_parceiro", "porto_teste_1")
            .param("evento_parceiro", "cotacao")
            .param("tipo_schema", "destino")
            .param("versao_schema", "v2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.evento_parceiro").value("cotacao"))
        .andExpect(jsonPath("$.versao_schema").value("v2"));
  }

  @Test
  void shouldRejectInvalidConfig() throws Exception {
    mockMvc.perform(post("/api/configs")
            .contentType("application/json")
            .content("{\"nome_parceiro\":\"porto_teste_1\"}"))
        .andExpect(status().isBadRequest());
  }
}
