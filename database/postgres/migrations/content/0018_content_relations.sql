-- Local-owner relations only. Validation fails atomically on existing orphans;
-- repair those rows explicitly before deployment, never delete them implicitly.
ALTER TABLE public.sections ADD CONSTRAINT sections_id_lesson_key UNIQUE (id,lesson_id);
ALTER TABLE public.dictationsections ADD CONSTRAINT dictationsections_id_topic_key UNIQUE (id,topic_id);

ALTER TABLE public.collections ADD CONSTRAINT collections_group_fk FOREIGN KEY (group_id) REFERENCES public.vocabularygroups(id) NOT VALID;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_collection_fk FOREIGN KEY (collection_id) REFERENCES public.collections(id) NOT VALID;
ALTER TABLE public.sections ADD CONSTRAINT sections_lesson_fk FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) NOT VALID;
ALTER TABLE public.lessonwords ADD CONSTRAINT lessonwords_lesson_fk FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) NOT VALID;
ALTER TABLE public.lessonwords ADD CONSTRAINT lessonwords_word_fk FOREIGN KEY (word_id) REFERENCES public.words(id) NOT VALID;
ALTER TABLE public.lessonwords ADD CONSTRAINT lessonwords_section_lesson_fk FOREIGN KEY (section_id,lesson_id) REFERENCES public.sections(id,lesson_id) NOT VALID;
ALTER TABLE public.dictationsections ADD CONSTRAINT dictationsections_topic_fk FOREIGN KEY (topic_id) REFERENCES public.dictationtopics(id) NOT VALID;
ALTER TABLE public.dictationlessons ADD CONSTRAINT dictationlessons_topic_fk FOREIGN KEY (topic_id) REFERENCES public.dictationtopics(id) NOT VALID;
ALTER TABLE public.dictationlessons ADD CONSTRAINT dictationlessons_section_fk FOREIGN KEY (section_id) REFERENCES public.dictationsections(id) NOT VALID;
ALTER TABLE public.dictationlessons ADD CONSTRAINT dictationlessons_section_topic_fk FOREIGN KEY (section_id,topic_id) REFERENCES public.dictationsections(id,topic_id) NOT VALID;
ALTER TABLE public.dictationsegments ADD CONSTRAINT dictationsegments_lesson_fk FOREIGN KEY (lesson_id) REFERENCES public.dictationlessons(id) NOT VALID;
ALTER TABLE public.dictationprogresses ADD CONSTRAINT dictationprogresses_lesson_fk FOREIGN KEY (lesson_id) REFERENCES public.dictationlessons(id) NOT VALID;

ALTER TABLE public.collections VALIDATE CONSTRAINT collections_group_fk;
ALTER TABLE public.lessons VALIDATE CONSTRAINT lessons_collection_fk;
ALTER TABLE public.sections VALIDATE CONSTRAINT sections_lesson_fk;
ALTER TABLE public.lessonwords VALIDATE CONSTRAINT lessonwords_lesson_fk;
ALTER TABLE public.lessonwords VALIDATE CONSTRAINT lessonwords_word_fk;
ALTER TABLE public.lessonwords VALIDATE CONSTRAINT lessonwords_section_lesson_fk;
ALTER TABLE public.dictationsections VALIDATE CONSTRAINT dictationsections_topic_fk;
ALTER TABLE public.dictationlessons VALIDATE CONSTRAINT dictationlessons_topic_fk;
ALTER TABLE public.dictationlessons VALIDATE CONSTRAINT dictationlessons_section_fk;
ALTER TABLE public.dictationlessons VALIDATE CONSTRAINT dictationlessons_section_topic_fk;
ALTER TABLE public.dictationsegments VALIDATE CONSTRAINT dictationsegments_lesson_fk;
ALTER TABLE public.dictationprogresses VALIDATE CONSTRAINT dictationprogresses_lesson_fk;
