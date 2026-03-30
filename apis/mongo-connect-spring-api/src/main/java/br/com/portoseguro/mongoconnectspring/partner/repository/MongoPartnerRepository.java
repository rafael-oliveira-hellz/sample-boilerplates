package br.com.portoseguro.mongoconnectspring.partner.repository;

import br.com.portoseguro.mongoconnectspring.partner.model.Partner;
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
public class MongoPartnerRepository implements PartnerRepository {

    private final MongoTemplate readMongoTemplate;
    private final MongoTemplate writeMongoTemplate;

    public MongoPartnerRepository(@Qualifier("readMongoTemplate") MongoTemplate readMongoTemplate,
                                  @Qualifier("writeMongoTemplate") MongoTemplate writeMongoTemplate) {
        this.readMongoTemplate = readMongoTemplate;
        this.writeMongoTemplate = writeMongoTemplate;
    }

    @Override
    public List<Partner> findAll() {
        Query query = new Query().addCriteria(Criteria.where("deleted").is(false)).with(Sort.by(Sort.Direction.ASC, "name"));
        return readMongoTemplate.find(query, Partner.class);
    }

    @Override
    public Page<Partner> findAll(Pageable pageable, String search) {
        Query query = new Query().addCriteria(Criteria.where("deleted").is(false));
        applySearch(query, search);
        query.with(pageable);
        List<Partner> items = readMongoTemplate.find(query, Partner.class);
        long total = readMongoTemplate.count(Query.of(query).limit(-1).skip(-1), Partner.class);
        return new PageImpl<>(items, pageable, total);
    }

    @Override
    public Optional<Partner> findById(UUID id) {
        Query query = Query.query(Criteria.where("_id").is(id).and("deleted").is(false));
        return Optional.ofNullable(readMongoTemplate.findOne(query, Partner.class));
    }

    @Override
    public Optional<Partner> findByNameIgnoreCase(String name) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("name").regex("^" + Pattern.quote(name) + "$", "i")
        ));
        return Optional.ofNullable(readMongoTemplate.findOne(query, Partner.class));
    }

    @Override
    public Partner save(Partner partner) {
        return writeMongoTemplate.save(partner);
    }

    @Override
    public void deleteById(UUID id) {
        Query query = Query.query(Criteria.where("_id").is(id));
        writeMongoTemplate.remove(query, Partner.class);
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