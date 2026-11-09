alter table positions
  add column report_path text;

insert into storage.buckets
  (id, name, public,
   file_size_limit,
   allowed_mime_types)
values
  ('recommendation-reports',
   'recommendation-reports',
   false,
   20971520,
   array['application/pdf']);
