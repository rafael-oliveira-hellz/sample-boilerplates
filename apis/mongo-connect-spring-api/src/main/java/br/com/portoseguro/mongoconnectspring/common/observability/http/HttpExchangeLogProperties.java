package br.com.portoseguro.mongoconnectspring.common.observability.http;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "application.observability.http")
public class HttpExchangeLogProperties {

    private boolean enabled = true;
    private boolean logBodies = false;
    private boolean logBodiesOnError = true;
    private int successSamplePercent = 5;
    private int maxPayloadLength = 8192;
    private List<String> redactedHeaders = List.of("authorization", "cookie", "set-cookie");

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isLogBodies() { return logBodies; }
    public void setLogBodies(boolean logBodies) { this.logBodies = logBodies; }
    public boolean isLogBodiesOnError() { return logBodiesOnError; }
    public void setLogBodiesOnError(boolean logBodiesOnError) { this.logBodiesOnError = logBodiesOnError; }
    public int getSuccessSamplePercent() { return successSamplePercent; }
    public void setSuccessSamplePercent(int successSamplePercent) { this.successSamplePercent = successSamplePercent; }
    public int getMaxPayloadLength() { return maxPayloadLength; }
    public void setMaxPayloadLength(int maxPayloadLength) { this.maxPayloadLength = maxPayloadLength; }
    public List<String> getRedactedHeaders() { return redactedHeaders; }
    public void setRedactedHeaders(List<String> redactedHeaders) { this.redactedHeaders = redactedHeaders; }

    public int normalizedSuccessSamplePercent() {
        return Math.max(0, Math.min(successSamplePercent, 100));
    }
}
