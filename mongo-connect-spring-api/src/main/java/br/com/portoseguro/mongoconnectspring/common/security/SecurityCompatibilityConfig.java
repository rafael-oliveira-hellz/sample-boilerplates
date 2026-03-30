package br.com.portoseguro.mongoconnectspring.common.security;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityCompatibilityConfig {

    @Bean
    ApplicationRunner securityCompatibilityRunner(
            AppSecurityProperties properties,
            ObjectProvider<Object> requestSecurityFilterProvider
    ) {
        return args -> {
            AppSecurityProperties.CorporateFilter corporateFilter = properties.getCorporateFilter();
            if (!corporateFilter.isEnabled()) {
                return;
            }

            boolean classPresent = isClassPresent(corporateFilter.getExpectedClassName());
            boolean beanPresent = requestSecurityFilterProvider.getIfAvailable() != null;
            if (corporateFilter.isRequired() && (!classPresent || !beanPresent)) {
                throw new IllegalStateException(
                        "Filtro corporativo RequestSecurityFilter nao encontrado no contexto. " +
                                "Classe esperada: " + corporateFilter.getExpectedClassName()
                );
            }
        };
    }

    private boolean isClassPresent(String className) {
        try {
            Class.forName(className);
            return true;
        } catch (ClassNotFoundException exception) {
            return false;
        }
    }
}
