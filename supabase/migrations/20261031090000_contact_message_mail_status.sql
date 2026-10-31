alter table public.contact_message
  add column mail_status text check (char_length(mail_status) <= 400);
grant insert (mail_status) on public.contact_message to anon;
comment on column public.contact_message.mail_status is 'Result of forwarding this message by email (FormSubmit response), so delivery problems can be read from the table.';
