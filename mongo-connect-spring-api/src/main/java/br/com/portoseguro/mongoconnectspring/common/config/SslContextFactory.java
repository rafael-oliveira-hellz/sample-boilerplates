package br.com.portoseguro.mongoconnectspring.common.config;

import java.io.FileInputStream;
import java.io.InputStream;
import java.security.KeyStore;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

@Component
public class SslContextFactory {

    private final ResourceLoader resourceLoader;

    public SslContextFactory(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public SSLContext createPkcs12Context(String certificatePath, String certificatePassword) {
        try {
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            char[] password = certificatePassword.toCharArray();

            try (InputStream inputStream = openCertificate(certificatePath)) {
                keyStore.load(inputStream, password);
            }

            KeyManagerFactory keyManagerFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            keyManagerFactory.init(keyStore, password);

            TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trustManagerFactory.init(keyStore);

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(keyManagerFactory.getKeyManagers(), trustManagerFactory.getTrustManagers(), null);
            return sslContext;
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel carregar o certificado PKCS12 do MongoDB.", exception);
        }
    }

    private InputStream openCertificate(String certificatePath) throws Exception {
        Resource resource = resourceLoader.getResource(certificatePath);
        if (resource.exists()) {
            return resource.getInputStream();
        }
        return new FileInputStream(certificatePath);
    }
}