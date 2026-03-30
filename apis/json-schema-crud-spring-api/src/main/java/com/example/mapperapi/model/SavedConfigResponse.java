package com.example.mapperapi.model;

import tools.jackson.databind.node.ObjectNode;

public record SavedConfigResponse(
    ObjectNode document
) {
}
