package br.com.portoseguro.mongoconnectspring.common.web.error;

import br.com.portoseguro.mongoconnectspring.common.observability.TraceCorrelation;
import br.com.portoseguro.mongoconnectspring.common.web.filter.RequestPathHolder;
import com.mongodb.MongoException;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiErrorHandler {

    private final TraceCorrelation traceCorrelation;

    public ApiErrorHandler(TraceCorrelation traceCorrelation) {
        this.traceCorrelation = traceCorrelation;
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.valueOf(exception.getStatusCode().value());
        return build(status, exception.getReason(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        return build(HttpStatus.BAD_REQUEST, "Erro de validacao", extractFieldErrors(exception.getBindingResult().getFieldErrors()));
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiErrorResponse> handleBindException(BindException exception) {
        return build(HttpStatus.BAD_REQUEST, "Erro de validacao", extractFieldErrors(exception.getBindingResult().getFieldErrors()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        String message = "[" + exception.getName() + "] deve possuir um valor valido";
        return build(HttpStatus.BAD_REQUEST, message, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        return build(HttpStatus.BAD_REQUEST, "Payload JSON invalido ou mal formatado.", null);
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateKey(DuplicateKeyException exception) {
        return build(HttpStatus.CONFLICT, "Registro duplicado. Violacao de unicidade no MongoDB.", null);
    }

    @ExceptionHandler(MongoException.class)
    public ResponseEntity<ApiErrorResponse> handleMongoException(MongoException exception) {
        if (exception.getCode() == 11000) {
            return build(HttpStatus.CONFLICT, "Registro duplicado. Violacao de unicidade no MongoDB.", null);
        }
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Falha de comunicacao com o MongoDB.", null);
    }

    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<ApiErrorResponse> handleDataAccessFailure(DataAccessResourceFailureException exception) {
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Falha de comunicacao com o MongoDB.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoResourceFound(NoResourceFoundException exception) {
        return build(HttpStatus.NOT_FOUND, "Recurso nao encontrado.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno nao tratado.", null);
    }

    private Map<String, String> extractFieldErrors(java.util.List<FieldError> fieldErrors) {
        return fieldErrors.stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage, (first, second) -> first));
    }

    private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String message, Map<String, String> fields) {
        ApiErrorResponse body = new ApiErrorResponse(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                RequestPathHolder.get(),
                traceCorrelation.traceId().orElse(null),
                traceCorrelation.spanId().orElse(null),
                fields
        );
        return ResponseEntity.status(status).body(body);
    }
}
