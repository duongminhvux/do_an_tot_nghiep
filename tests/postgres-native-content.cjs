/** SQL integration against PostgreSQL in WASM; no mocked query execution. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(
  require.resolve("@electric-sql/pglite", {
    paths: [path.resolve(__dirname, "../apps/api")],
  }),
);
const load = require("./helpers/load-typescript.cjs");
const root = path.resolve(__dirname, "..");
const source = (relative) => load(path.join(root, "apps/api/src", relative));
const { ContentSqlRepository } = source(
  "modules/vocabulary/content-sql.repository.ts",
);
const { VocabularyGroupsService } = source(
  "modules/vocabulary/groups/vocabulary-groups.service.ts",
);
const { CollectionsService } = source(
  "modules/vocabulary/collections/collections.service.ts",
);
const { LessonsService } = source(
  "modules/vocabulary/lessons/lessons.service.ts",
);
const { WordsService } = source("modules/vocabulary/words/words.service.ts");
const { AdminsService } = source("modules/admins/admins.service.ts");
const { updateAudio, parseAudioFields } = source("common/media/audio-sql.ts");
const { hashPassword } = source("common/bcrypt.ts");
const { publicationScope } = source("modules/publication/publication-scope.ts");
const { sql, rows, rowData } = source("postgres/sql.ts");
const { createConnection, withPgTransaction } = source(
  "postgres/connection.ts",
);

(async () => {
  const database = new PGlite();
  const previousRole = process.env.SERVICE_ROLE;
  process.env.SERVICE_ROLE = "content";
  const statements = [];
  // Expose the real PostgreSQL executor as a PoolClient. Transaction helpers
  // must not acquire or commit a second connection inside the outer transaction.
  const client = {
    query: async (text, params = []) => {
      statements.push({ text, params });
      return database.query(text, params);
    },
    release() {},
  };
  const connection = createConnection(client);
  try {
    for (const file of [
      "0001_baseline.sql",
      "0002_adopt_repairs.sql",
      "0015_content_publication.sql",
    ]) {
      await database.exec(
        fs.readFileSync(
          path.join(root, "database/postgres/migrations/content", file),
          "utf8",
        ),
      );
    }
    await database.exec(
      fs.readFileSync(
        path.join(
          root,
          "database/postgres/migrations/identity/0001_baseline.sql",
        ),
        "utf8",
      ),
    );
    const repository = new ContentSqlRepository(connection);
    const i18n = { t: async (key) => key };
    const groups = new VocabularyGroupsService(repository, i18n);
    const collections = new CollectionsService(repository, i18n);
    const lessons = new LessonsService(repository, i18n);
    const words = new WordsService(repository, i18n);
    const group = await groups.create({ name: "Basics" });
    await assert.rejects(
      groups.create({ name: "BASICS" }),
      /GROUP_ALREADY_EXISTS/,
    );
    const collection = await collections.create({
      name: "Animals",
      groupId: group._id,
    });
    const lesson = await lessons.createLesson({
      title: "Pets",
      collectionId: collection._id,
    });
    const section = await lessons.createSection(lesson._id, {
      name: "Mammals",
    });
    const cat = (
      await words.create({
        word: "Cat",
        level: "A1",
        variations: ["cats"],
        relatedWords: ["kitten"],
        parts: [
          {
            partOfSpeech: "noun",
            meanings: [{ definition: "a pet", translation: ["mèo"] }],
          },
        ],
      })
    ).data;
    const dog = (await words.create({ word: "Dog", level: "A2" })).data;
    assert.deepEqual(cat.variations, ["cats"]);
    assert.deepEqual(cat.relatedWords, ["kitten"]);

    await lessons.addWordsToLesson(
      lesson._id,
      [cat._id, dog._id, cat._id],
      section._id,
    );
    await lessons.addWordsToLesson(lesson._id, [cat._id]);
    assert.equal((await lessons.getWordsInLesson(lesson._id)).length, 2);
    const populated = await lessons.getWordsInLesson(lesson._id);
    assert.equal(
      populated.find((item) => item.wordId._id === cat._id).sectionId._id,
      section._id,
    );
    assert.equal((await lessons.findOneLesson(lesson._id)).wordsCount, 2);
    assert.equal((await lessons.getSections(lesson._id))[0].wordsCount, 2);
    assert.equal((await groups.findAll({})).data[0].wordsCount, 2);
    assert.equal(
      (await collections.findAll({})).data[0].groupId.name,
      "Basics",
    );
    assert.equal((await collections.findOne(collection._id)).lessonsCount, 1);
    assert.equal((await words.findAll({ partOfSpeech: "noun" })).total, 1);
    assert.equal((await words.findAll({ search: "' OR TRUE --" })).total, 0);
    const lookup = await words.bulkLookup([" cat ", "CAT", "Dog", "unknown"]);
    assert.equal(lookup.totalFound, 2);
    assert.deepEqual(lookup.notFound, ["unknown"]);
    await groups.reorderGroups([
      { id: group._id, order: 7 },
      { id: group._id, order: 3 },
    ]);
    assert.equal((await groups.findOne(group._id)).order, 3);
    await lessons.reorderSections(lesson._id, [{ id: section._id, order: 5 }]);
    assert.equal((await lessons.getSectionById(section._id)).order, 5);
    await lessons.reorderLessonWords(lesson._id, [
      { wordId: cat._id, order: 8, sectionId: null },
      { wordId: dog._id, order: 1 },
    ]);
    assert.equal(
      (await lessons.getWordsInLesson(lesson._id)).find(
        (item) => item.wordId._id === cat._id,
      ).sectionId,
      null,
    );
    await lessons.updateLessonWord(lesson._id, cat._id, {
      customNote: "test",
      sectionId: section._id,
    });
    assert.equal((await lessons.getSectionById(section._id)).wordsCount, 2);
    // Old payload copies must never resurrect a detached reference.
    await database.query(
      "UPDATE collections SET payload = jsonb_build_object('groupId', $1::text) WHERE id = $2",
      [group._id, collection._id],
    );
    await groups.remove(group._id);
    assert.equal((await collections.findOne(collection._id)).groupId, null);
    assert.equal(
      (
        await database.query("SELECT payload FROM collections WHERE id = $1", [
          collection._id,
        ])
      ).rows[0].payload.groupId,
      undefined,
    );
    await groups.restore(group._id);
    await lessons.deleteSection(section._id);
    assert(
      (await lessons.getWordsInLesson(lesson._id)).every(
        (item) => item.sectionId === null,
      ),
    );
    // Learner publication gates apply to list, detail, counts and joined words.
    const hidden = await publicationScope.run(true, () => words.findAll({}));
    assert.equal(hidden.total, 0);
    await database.exec(
      "SELECT set_config('vocalearn.publication_transition', '1', false)",
    );
    await database.exec(
      "UPDATE words SET publication_status = 'PUBLISHED'; UPDATE lessons SET publication_status = 'PUBLISHED'",
    );
    await database.exec(
      "SELECT set_config('vocalearn.publication_transition', '0', false)",
    );
    assert.equal(
      (await publicationScope.run(true, () => words.findAll({}))).total,
      2,
    );
    await updateAudio(connection, "words", cat._id, {
      "audioMeta.us.status": "PROCESSING",
      "audioMeta.us.error": "",
      "audio.us": "https://audio.test/us.wav",
    });
    const audio = (await words.findOne(cat._id)).data;
    assert.equal(audio.audio.us, "https://audio.test/us.wav");
    assert.equal(audio.audioMeta.us.status, "PROCESSING");
    await updateAudio(connection, "words", cat._id, {
      "audioMeta.us": { status: "READY", storageKey: "us" },
      "audioMeta.uk": { status: "PROCESSING", storageKey: "uk" },
    });
    await updateAudio(connection, "words", cat._id, {
      "audioMeta.us.error": "last error",
    });
    assert.equal(
      (await words.findOne(cat._id)).data.audioMeta.us.storageKey,
      "us",
    );
    await assert.rejects(
      updateAudio(connection, "words", cat._id, {
        "audioMeta.$.status": "bad",
      }),
      /Only audio/,
    );
    await assert.rejects(
      updateAudio(connection, "words", cat._id, { name: "bad" }),
      /Only audio/,
    );
    assert.throws(
      () => parseAudioFields({ $set: { audio: {} } }),
      /Audio fields required/,
    );
    const revisionBefore = (await words.findOne(cat._id)).data
      .publicationRevision;
    await words.update(cat._id, { word: "Kitty" });
    const updated = (await words.findOne(cat._id)).data;
    assert.equal(updated.audioMeta.us.status, "STALE");
    assert.equal(updated.audioMeta.uk.status, "PROCESSING");
    assert.equal(updated.publicationStatus, "DRAFT");
    assert.equal(updated.publicationRevision, revisionBefore + 1);
    const bulk = await words.bulkToggleActive(
      [cat._id, "00000000-0000-4000-8000-000000000099"],
      false,
    );
    assert.equal(bulk.modifiedCount, 1);
    await words.remove(dog._id);
    await assert.rejects(words.findOne(dog._id), /WORD_NOT_FOUND/);
    await words.restore(dog._id);
    // A SQL-shaped user object remains a bound value, never SQL code.
    const malicious = { text: "DROP TABLE words", values: [] };
    assert.deepEqual(sql`SELECT ${malicious}`.values, [malicious]);
    assert.equal(
      sql`SELECT ${sql`${1} + ${2}`} + ${3}`.text,
      "SELECT $1 + $2 + $3",
    );
    assert.equal(
      rowData({ id: cat._id, group_id: null, payload: { groupId: "stale" } })
        .groupId,
      null,
    );
    // Exercise rollback using an actual pool boundary, not only a client.
    const pool = { query: client.query, connect: async () => client };
    await assert.rejects(
      withPgTransaction(createConnection(pool), async (transaction) => {
        await rows(
          transaction,
          sql`UPDATE vocabularygroups SET name = 'rolled-back' WHERE id = ${group._id}::uuid`,
        );
        throw new Error("rollback-test");
      }),
      /rollback-test/,
    );
    assert.notEqual((await groups.findOne(group._id)).name, "rolled-back");
    const transactionalGroups = new VocabularyGroupsService(
      new ContentSqlRepository(createConnection(pool)),
      i18n,
    );
    const protectedGroup = await groups.create({ name: "Rollback group" });
    const protectedCollection = await collections.create({
      name: "Rollback collection",
      groupId: protectedGroup._id,
    });
    await database.exec(`CREATE FUNCTION reject_test_detach() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF OLD.id = '${protectedCollection._id}'::uuid AND NEW.group_id IS NULL THEN RAISE EXCEPTION 'detach-test'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER reject_test_detach BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION reject_test_detach()`);
    await assert.rejects(
      transactionalGroups.remove(protectedGroup._id),
      /detach-test/,
    );
    assert.equal((await groups.findOne(protectedGroup._id)).isDeleted, false);
    assert.equal(
      (await collections.findOne(protectedCollection._id)).groupId._id,
      protectedGroup._id,
    );
    await database.exec(
      "DROP TRIGGER reject_test_detach ON collections; DROP FUNCTION reject_test_detach()",
    );
    // Authentication now reads SQL columns, including the authoritative password hash.
    process.env.SERVICE_ROLE = "identity";
    const adminId = "00000000-0000-4000-8000-000000000042";
    await database.query(
      "INSERT INTO admins(id,email,username,password_hash,payload) VALUES($1,$2,$3,$4,$5)",
      [
        adminId,
        "admin@test.example",
        "admin",
        await hashPassword("test-secret"),
        JSON.stringify({ password: "stale-password" }),
      ],
    );
    const admins = new AdminsService(connection, i18n);
    assert.equal((await admins.findByEmail("ADMIN@TEST.EXAMPLE"))._id, adminId);
    assert.equal((await admins.findById(adminId)).username, "admin");
    assert.equal(
      (await admins.findByUsername("admin")).email,
      "admin@test.example",
    );
    const authenticated = await admins.validateAdmin("admin", "test-secret");
    assert(!("password" in authenticated));
    await assert.rejects(
      admins.validateAdmin("admin' OR TRUE --", "test-secret"),
      /INVALID_CREDENTIALS/,
    );
    await assert.rejects(
      admins.validateAdmin("admin", "incorrect"),
      /INVALID_CREDENTIALS/,
    );
    await database.query("UPDATE admins SET is_deleted=true WHERE id=$1", [
      adminId,
    ]);
    await assert.rejects(
      admins.validateAdmin("admin", "test-secret"),
      /ACCOUNT_DELETED/,
    );
    assert(statements.some((item) => /jsonb_to_recordset/.test(item.text)));
    assert(!statements.some((item) => item.text.includes("' OR TRUE --")));
    console.log(
      "PASS: native vocabulary/admin/audio SQL integration (CRUD, JSONB, joins, bulk writes, publication, rollback, authentication)",
    );
  } finally {
    await database.close();
    if (previousRole === undefined) delete process.env.SERVICE_ROLE;
    else process.env.SERVICE_ROLE = previousRole;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
