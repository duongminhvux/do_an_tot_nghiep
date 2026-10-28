ALTER TABLE public.vocabularyfolders ADD CONSTRAINT vocabularyfolders_id_user_key UNIQUE (id,user_id);
ALTER TABLE public.learningsessionwords ADD CONSTRAINT learningsessionwords_session_fk FOREIGN KEY (session_id) REFERENCES public.learningsessions(id) NOT VALID;
-- A saved word cannot belong to a folder owned by a different user.
ALTER TABLE public.usersavedwords ADD CONSTRAINT usersavedwords_folder_owner_fk FOREIGN KEY (folder_id,user_id) REFERENCES public.vocabularyfolders(id,user_id) NOT VALID;
ALTER TABLE public.learningsessionwords VALIDATE CONSTRAINT learningsessionwords_session_fk;
ALTER TABLE public.usersavedwords VALIDATE CONSTRAINT usersavedwords_folder_owner_fk;
