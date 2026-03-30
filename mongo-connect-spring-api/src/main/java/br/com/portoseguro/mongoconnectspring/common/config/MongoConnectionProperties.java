package br.com.portoseguro.mongoconnectspring.common.config;

import com.mongodb.ServerAddress;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "spring.data.mongodb")
public record MongoConnectionProperties(
        String database,
        String host,
        String replicaSet,
        Boolean mtls,
        String authDatabase,
        String writeUsername,
        String readUsername,
        String writePassword,
        String readPassword,
        Certificate certificate,
        Pool pool
) {

    public record Certificate(String path, String pwd) {
    }

    public record Pool(
            Integer minSize,
            Integer maxSize,
            Integer maxWaitMs,
            Integer connectTimeoutMs,
            Integer readTimeoutMs,
            Integer maxConnectionIdleMs
    ) {
        public int effectiveMinSize() { return minSize == null ? 5 : minSize; }
        public int effectiveMaxSize() { return maxSize == null ? 50 : maxSize; }
        public int effectiveMaxWaitMs() { return maxWaitMs == null ? 5_000 : maxWaitMs; }
        public int effectiveConnectTimeoutMs() { return connectTimeoutMs == null ? 3_000 : connectTimeoutMs; }
        public int effectiveReadTimeoutMs() { return readTimeoutMs == null ? 5_000 : readTimeoutMs; }
        public int effectiveMaxConnectionIdleMs() { return maxConnectionIdleMs == null ? 60_000 : maxConnectionIdleMs; }
    }

    public String effectiveAuthDatabase() {
        return authDatabase == null || authDatabase.isBlank() ? database : authDatabase;
    }

    public boolean isMtlsEnabled() {
        return Boolean.TRUE.equals(mtls);
    }

    public String effectiveWriteUsername() {
        return writeUsername;
    }

    public String effectiveReadUsername() {
        return readUsername;
    }

    public String effectiveWritePassword() {
        return writePassword;
    }

    public String effectiveReadPassword() {
        return readPassword;
    }

    public String effectiveCertificatePath() {
        return certificate == null ? null : certificate.path();
    }

    public String effectiveCertificatePassword() {
        return certificate == null ? null : certificate.pwd();
    }

    public Pool effectivePool() {
        return pool == null ? new Pool(null, null, null, null, null, null) : pool;
    }

    public List<ServerAddress> effectiveHosts() {
        return Stream.of(host.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(this::toServerAddress)
                .toList();
    }

    private ServerAddress toServerAddress(String value) {
        int separator = value.lastIndexOf(':');
        if (separator > 0 && separator < value.length() - 1 && value.indexOf(']') == -1) {
            String parsedHost = value.substring(0, separator).trim();
            int parsedPort = Integer.parseInt(value.substring(separator + 1).trim());
            return new ServerAddress(parsedHost, parsedPort);
        }
        return new ServerAddress(value);
    }
}