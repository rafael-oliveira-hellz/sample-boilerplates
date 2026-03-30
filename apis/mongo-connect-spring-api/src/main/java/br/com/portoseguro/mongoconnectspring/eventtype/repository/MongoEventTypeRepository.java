package br.com.portoseguro.mongoconnectspring.eventtype.repository;

import br.com.portoseguro.mongoconnectspring.eventtype.model.EventType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class MongoEventTypeRepository implements EventTypeRepository {

    private final MongoTemplate readMongoTemplate;
    private final MongoTemplate writeMongoTemplate;

    public MongoEventTypeRepository(
            @Qualifier("readMongoTemplate") MongoTemplate readMongoTemplate,
            @Qualifier("writeMongoTemplate") MongoTemplate writeMongoTemplate
    ) {
        this.readMongoTemplate = readMongoTemplate;
        this.writeMongoTemplate = writeMongoTemplate;
    }

    @Override
    public List<EventType> findAll() {
        Query query = new Query().with(Sort.by(Sort.Direction.ASC, "name"));
        return readMongoTemplate.find(query, EventType.class);
    }

    @Override
    public Page<EventType> findAll(Pageable pageable, String search) {
        Query query = new Query();
        applySearch(query, search);
        query.with(pageable);

        List<EventType> items = readMongoTemplate.find(query, EventType.class);
        long total = readMongoTemplate.count(Query.of(query).limit(-1).skip(-1), EventType.class);
        return new PageImpl<>(items, pageable, total);
    }

    @Override
    public Optional<EventType> findById(UUID id) {
        return Optional.ofNullable(readMongoTemplate.findById(id, EventType.class));
    }

    @Override
    public Optional<EventType> findByName(String name) {
        Query query = Query.query(Criteria.where("name").is(name));
        return Optional.ofNullable(readMongoTemplate.findOne(query, EventType.class));
    }

    @Override
    public Optional<EventType> findByNameIgnoreCase(String name) {
        Query query = Query.query(Criteria.where("name").regex("^" + Pattern.quote(name) + "$", "i"));
        return Optional.ofNullable(readMongoTemplate.findOne(query, EventType.class));
    }

    @Override
    public EventType save(EventType eventType) {
        return writeMongoTemplate.save(eventType);
    }

    @Override
    public void deleteById(UUID id) {
        Query query = Query.query(Criteria.where("_id").is(id));
        writeMongoTemplate.remove(query, EventType.class);
    }

    private void applySearch(Query query, String search) {
        if (search == null || search.isBlank()) {
            return;
        }

        String containsRegex = ".*" + Pattern.quote(search) + ".*";
        query.addCriteria(new Criteria().orOperator(
                Criteria.where("name").regex(containsRegex, "i"),
                Criteria.where("description").regex(containsRegex, "i")
        ));
    }
}
