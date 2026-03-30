package br.com.portoseguro.mongoconnectspring.common.config;

import com.mongodb.MongoClientSettings;
import com.mongodb.MongoCredential;
import com.mongodb.ReadPreference;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.util.concurrent.TimeUnit;
import org.bson.UuidRepresentation;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

@Configuration
@EnableConfigurationProperties(MongoConnectionProperties.class)
public class MongoConfig {

    private final SslContextFactory sslContextFactory;

    public MongoConfig(SslContextFactory sslContextFactory) {
        this.sslContextFactory = sslContextFactory;
    }

    @Bean
    @Primary
    MongoClient writeMongoClient(MongoConnectionProperties properties) {
        return buildClient(properties, properties.effectiveWriteUsername(), properties.effectiveWritePassword(), ReadPreference.primary());
    }

    @Bean
    MongoClient readMongoClient(MongoConnectionProperties properties) {
        return buildClient(properties, properties.effectiveReadUsername(), properties.effectiveReadPassword(), ReadPreference.secondaryPreferred());
    }

    @Bean
    @Primary
    MongoDatabaseFactory writeMongoDatabaseFactory(@Qualifier("writeMongoClient") MongoClient mongoClient, MongoConnectionProperties properties) {
        return new SimpleMongoClientDatabaseFactory(mongoClient, properties.database());
    }

    @Bean
    MongoDatabaseFactory readMongoDatabaseFactory(@Qualifier("readMongoClient") MongoClient mongoClient, MongoConnectionProperties properties) {
        return new SimpleMongoClientDatabaseFactory(mongoClient, properties.database());
    }

    @Bean
    @Primary
    MongoTemplate writeMongoTemplate(@Qualifier("writeMongoDatabaseFactory") MongoDatabaseFactory factory) {
        return new MongoTemplate(factory);
    }

    @Bean
    MongoTemplate readMongoTemplate(@Qualifier("readMongoDatabaseFactory") MongoDatabaseFactory factory) {
        return new MongoTemplate(factory);
    }

    private MongoClient buildClient(MongoConnectionProperties properties, String username, String password, ReadPreference readPreference) {
        MongoConnectionProperties.Pool pool = properties.effectivePool();

        MongoClientSettings.Builder settings = MongoClientSettings.builder()
                .uuidRepresentation(UuidRepresentation.STANDARD)
                .retryReads(true)
                .retryWrites(true)
                .credential(MongoCredential.createCredential(username, properties.effectiveAuthDatabase(), password.toCharArray()))
                .applyToClusterSettings(cluster -> {
                    cluster.hosts(properties.effectiveHosts());
                    if (properties.replicaSet() != null && !properties.replicaSet().isBlank()) {
                        cluster.requiredReplicaSetName(properties.replicaSet());
                    }
                })
                .applyToConnectionPoolSettings(poolSettings -> {
                    poolSettings.minSize(pool.effectiveMinSize());
                    poolSettings.maxSize(pool.effectiveMaxSize());
                    poolSettings.maxWaitTime(pool.effectiveMaxWaitMs(), TimeUnit.MILLISECONDS);
                    poolSettings.maxConnectionIdleTime(pool.effectiveMaxConnectionIdleMs(), TimeUnit.MILLISECONDS);
                })
                .applyToSocketSettings(socket -> {
                    socket.connectTimeout(pool.effectiveConnectTimeoutMs(), TimeUnit.MILLISECONDS);
                    socket.readTimeout(pool.effectiveReadTimeoutMs(), TimeUnit.MILLISECONDS);
                })
                .readPreference(readPreference)
                .applicationName("sboot-segu-aseg-hubin-ops");

        if (properties.isMtlsEnabled()) {
            settings.applyToSslSettings(ssl -> {
                ssl.enabled(true);
                ssl.context(sslContextFactory.createPkcs12Context(properties.effectiveCertificatePath(), properties.effectiveCertificatePassword()));
            });
        }

        return MongoClients.create(settings.build());
    }
}