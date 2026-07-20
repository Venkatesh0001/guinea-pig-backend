-- Add additional_image_urls text array column to recommended_products
alter table public.recommended_products 
add column if not exists additional_image_urls text[] default '{}'::text[] not null;
