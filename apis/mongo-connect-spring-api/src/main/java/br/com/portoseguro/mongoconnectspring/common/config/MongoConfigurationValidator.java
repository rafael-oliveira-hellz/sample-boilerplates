package br.com.portoseguro.mongoconnectspring.common.config;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class MongoConfigurationValidator {

    private final MongoConnectionProperties properties;
    private final SslContextFactory sslContextFactory;

    public MongoConfigurationValidator(MongoConnectionProperties properties, SslContextFactory sslContextFactory) {
        this.properties = properties;
        this.sslContextFactory = sslContextFactory;
    }

    @PostConstruct
    void validate() {
        require(properties.database(), "spring.data.mongodb.database");
        require(properties.host(), "spring.data.mongodb.host");
        require(properties.effectiveAuthDatabase(), "spring.data.mongodb.auth-database");
        require(properties.effectiveWriteUsername(), "spring.data.mongodb.write-username");
        require(properties.effectiveReadUsername(), "spring.data.mongodb.read-username");
        require(properties.effectiveWritePassword(), "spring.data.mongodb.write-password");
        require(properties.effectiveReadPassword(), "spring.data.mongodb.read-password");

        if (properties.effectiveHosts().isEmpty()) {
            throw new IllegalStateException("A configuracao spring.data.mongodb.host deve conter ao menos um host valido.");
        }

        if (properties.isMtlsEnabled()) {
            require(properties.effectiveCertificatePath(), "spring.data.mongodb.certificate.path");
            require(properties.effectiveCertificatePassword(), "spring.data.mongodb.certificate.pwd");
            sslContextFactory.createPkcs12Context(properties.effectiveCertificatePath(), properties.effectiveCertificatePassword());
        }
    }

    private void require(String value, String property) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("A propriedade obrigatoria '" + property + "' nao foi configurada.");
        }
    }
}