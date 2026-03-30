package com.example.mapperapi.controller;

import com.example.mapperapi.service.ConfigStorageService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/configs")
@CrossOrigin(origins = "http://localhost:3000")
public class ConfigController {

  private final ConfigStorageService configStorageService;

  public ConfigController(ConfigStorageService configStorageService) {
    this.configStorageService = configStorageService;
  }

  @PostMapping
  public ObjectNode save(@RequestBody JsonNode config) {
    return configStorageService.save(config);
  }

  @GetMapping("/latest")
  public ObjectNode latest(
      @RequestParam(name = "nome_parceiro", required = false) String nomeParceiro,
      @RequestParam(name = "evento_parceiro", required = false) String eventoParceiro,
      @RequestParam(name = "tipo_schema", required = false) String tipoSchema,
      @RequestParam(name = "versao_schema", required = false) String versaoSchema
  ) {
    return configStorageService.findLatest(nomeParceiro, eventoParceiro, tipoSchema, versaoSchema);
  }
}
