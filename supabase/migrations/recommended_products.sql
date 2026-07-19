-- 1. Create merchants table
create table if not exists public.merchants (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    logo_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create recommended_products table
create table if not exists public.recommended_products (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    primary_image_url text,
    category text,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create product_offers junction table
create table if not exists public.product_offers (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.recommended_products(id) on delete cascade not null,
    merchant_id uuid references public.merchants(id) on delete cascade not null,
    manual_price numeric(10, 2),
    affiliate_url text not null,
    clicks bigint default 0 not null,
    last_updated timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_product_merchant unique (product_id, merchant_id)
);

-- 4. Enable Row Level Security (RLS)
alter table public.merchants enable row level security;
alter table public.recommended_products enable row level security;
alter table public.product_offers enable row level security;

-- 5. RLS Policies for public read access
create policy "Allow public select access on merchants"
    on public.merchants for select
    to public
    using (true);

create policy "Allow public select access on recommended_products"
    on public.recommended_products for select
    to public
    using (true);

create policy "Allow public select access on product_offers"
    on public.product_offers for select
    to public
    using (true);

-- 6. RLS Policies for authenticated admin write access
create policy "Allow admin insert on merchants"
    on public.merchants for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin update on merchants"
    on public.merchants for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin delete on merchants"
    on public.merchants for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin insert on recommended_products"
    on public.recommended_products for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin update on recommended_products"
    on public.recommended_products for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin delete on recommended_products"
    on public.recommended_products for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin insert on product_offers"
    on public.product_offers for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin update on product_offers"
    on public.product_offers for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admin delete on product_offers"
    on public.product_offers for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 7. Indexes for optimization
create index if not exists idx_product_offers_product_id on public.product_offers(product_id);
create index if not exists idx_product_offers_merchant_id on public.product_offers(merchant_id);
create index if not exists idx_recommended_products_category on public.recommended_products(category);
create index if not exists idx_recommended_products_is_active on public.recommended_products(is_active);

-- 8. Auto-updating last_updated trigger
create or replace function public.update_last_updated_column()
returns trigger as $$
begin
    new.last_updated = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger tr_update_product_offers_last_updated
    before update on public.product_offers
    for each row
    when (old.manual_price is distinct from new.manual_price or old.affiliate_url is distinct from new.affiliate_url)
    execute function public.update_last_updated_column();
