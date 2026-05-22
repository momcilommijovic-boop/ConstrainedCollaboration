create table if not exists demo_content (
  id uuid primary key default gen_random_uuid(),
  author_email text not null unique,
  article_title text not null,
  article_body text not null
);
