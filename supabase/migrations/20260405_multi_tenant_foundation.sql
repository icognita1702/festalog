BEGIN;

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    owner_name TEXT NOT NULL DEFAULT '',
    owner_email TEXT,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT NOT NULL DEFAULT '',
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('contrato', 'orcamento')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS owner_email TEXT,
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.public_access_tokens
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS public_access_tokens_token_hash_idx
    ON public.public_access_tokens (token_hash);

DO $$
DECLARE
    legacy_tenant_id UUID;
BEGIN
    INSERT INTO public.tenants (slug, display_name, owner_name, onboarding_completed)
    VALUES (
        'gabriel-lucas-santos-souza',
        'Gabriel Lucas Santos Souza',
        'gabriel lucas santos souza',
        TRUE
    )
    ON CONFLICT (slug) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        owner_name = EXCLUDED.owner_name
    RETURNING id INTO legacy_tenant_id;

    ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE public.itens_pedido ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS tenant_id UUID;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'configuracoes'
    ) THEN
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS tenant_id UUID;
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS whatsapp_proprietario TEXT DEFAULT '';
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS preco_km NUMERIC(10, 2) DEFAULT 0;
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS frete_minimo NUMERIC(10, 2) DEFAULT 0;
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT '';
        ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT '';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'categorias'
    ) THEN
        ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'despesas'
    ) THEN
        ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pagamentos'
    ) THEN
        ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notificacoes'
    ) THEN
        ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;

    UPDATE public.clientes SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.produtos SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.pedidos SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.rotas SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;

    UPDATE public.itens_pedido ip
    SET tenant_id = p.tenant_id
    FROM public.pedidos p
    WHERE ip.pedido_id = p.id
      AND ip.tenant_id IS NULL;

    UPDATE public.itens_pedido SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'configuracoes'
    ) THEN
        UPDATE public.configuracoes
        SET tenant_id = legacy_tenant_id
        WHERE tenant_id IS NULL;

        ALTER TABLE public.configuracoes
            ALTER COLUMN nome_empresa SET DEFAULT '',
            ALTER COLUMN cnpj SET DEFAULT '',
            ALTER COLUMN endereco SET DEFAULT '',
            ALTER COLUMN telefone SET DEFAULT '',
            ALTER COLUMN email SET DEFAULT '',
            ALTER COLUMN pix_tipo SET DEFAULT '',
            ALTER COLUMN pix_chave SET DEFAULT '',
            ALTER COLUMN pix_nome SET DEFAULT '',
            ALTER COLUMN pix_banco SET DEFAULT '',
            ALTER COLUMN google_place_id SET DEFAULT '',
            ALTER COLUMN whatsapp_instance SET DEFAULT '',
            ALTER COLUMN mensagem_boas_vindas SET DEFAULT 'Olá! Como posso ajudar?',
            ALTER COLUMN whatsapp_proprietario SET DEFAULT '',
            ALTER COLUMN preco_km SET DEFAULT 0,
            ALTER COLUMN frete_minimo SET DEFAULT 0,
            ALTER COLUMN cidade SET DEFAULT '',
            ALTER COLUMN estado SET DEFAULT '';

        CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_tenant_id_idx
            ON public.configuracoes (tenant_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'categorias'
    ) THEN
        UPDATE public.categorias
        SET tenant_id = legacy_tenant_id
        WHERE tenant_id IS NULL;

        IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'categorias'
              AND constraint_name = 'categorias_nome_key'
        ) THEN
            ALTER TABLE public.categorias DROP CONSTRAINT categorias_nome_key;
        END IF;

        CREATE UNIQUE INDEX IF NOT EXISTS categorias_tenant_nome_idx
            ON public.categorias (tenant_id, nome);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'despesas'
    ) THEN
        UPDATE public.despesas SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pagamentos'
    ) THEN
        UPDATE public.pagamentos pg
        SET tenant_id = p.tenant_id
        FROM public.pedidos p
        WHERE pg.pedido_id = p.id
          AND pg.tenant_id IS NULL;

        UPDATE public.pagamentos SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notificacoes'
    ) THEN
        UPDATE public.notificacoes n
        SET tenant_id = p.tenant_id
        FROM public.pedidos p
        WHERE n.pedido_id = p.id
          AND n.tenant_id IS NULL;

        UPDATE public.notificacoes SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
    END IF;

    ALTER TABLE public.clientes ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.produtos ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.pedidos ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.itens_pedido ALTER COLUMN tenant_id SET NOT NULL;
    ALTER TABLE public.rotas ALTER COLUMN tenant_id SET NOT NULL;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'configuracoes'
    ) THEN
        ALTER TABLE public.configuracoes ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'categorias'
    ) THEN
        ALTER TABLE public.categorias ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'despesas'
    ) THEN
        ALTER TABLE public.despesas ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pagamentos'
    ) THEN
        ALTER TABLE public.pagamentos ALTER COLUMN tenant_id SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notificacoes'
    ) THEN
        ALTER TABLE public.notificacoes ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.assign_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.current_tenant_id();
    END IF;

    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_tenant_id UUID;
    selected_tenant_id UUID;
    user_email TEXT;
    user_full_name TEXT;
    base_slug TEXT;
    candidate_slug TEXT;
    slug_suffix INTEGER := 0;
BEGIN
    SELECT tenant_id
    INTO profile_tenant_id
    FROM public.profiles
    WHERE id = p_user_id
    LIMIT 1;

    IF profile_tenant_id IS NOT NULL THEN
        RETURN profile_tenant_id;
    END IF;

    SELECT
        email,
        COALESCE(
            raw_user_meta_data ->> 'full_name',
            raw_user_meta_data ->> 'name',
            split_part(email, '@', 1),
            ''
        )
    INTO user_email, user_full_name
    FROM auth.users
    WHERE id = p_user_id;

    IF LOWER(COALESCE(user_full_name, '')) = 'gabriel lucas santos souza' THEN
        SELECT id
        INTO selected_tenant_id
        FROM public.tenants
        WHERE slug = 'gabriel-lucas-santos-souza'
        LIMIT 1;
    END IF;

    IF selected_tenant_id IS NULL THEN
        base_slug := LOWER(REGEXP_REPLACE(COALESCE(user_full_name, ''), '[^a-zA-Z0-9]+', '-', 'g'));
        base_slug := TRIM(BOTH '-' FROM base_slug);

        IF base_slug = '' THEN
            base_slug := LOWER(REGEXP_REPLACE(COALESCE(split_part(user_email, '@', 1), 'tenant'), '[^a-zA-Z0-9]+', '-', 'g'));
            base_slug := TRIM(BOTH '-' FROM base_slug);
        END IF;

        candidate_slug := COALESCE(NULLIF(base_slug, ''), 'tenant');

        WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = candidate_slug) LOOP
            slug_suffix := slug_suffix + 1;
            candidate_slug := base_slug || '-' || slug_suffix::TEXT;
        END LOOP;

        INSERT INTO public.tenants (slug, display_name, owner_name, owner_email)
        VALUES (
            candidate_slug,
            COALESCE(NULLIF(user_full_name, ''), split_part(COALESCE(user_email, 'tenant@example.com'), '@', 1)),
            COALESCE(user_full_name, ''),
            user_email
        )
        RETURNING id INTO selected_tenant_id;

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'configuracoes'
        ) THEN
            INSERT INTO public.configuracoes (tenant_id)
            VALUES (selected_tenant_id)
            ON CONFLICT (tenant_id) DO NOTHING;
        END IF;
    END IF;

    INSERT INTO public.profiles (id, tenant_id, email, full_name, is_owner)
    VALUES (p_user_id, selected_tenant_id, user_email, COALESCE(user_full_name, ''), TRUE)
    ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        is_owner = EXCLUDED.is_owner;

    RETURN selected_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.ensure_profile_for_user(auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_touch_updated_at ON public.tenants;
CREATE TRIGGER tenants_touch_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS clientes_assign_tenant_id ON public.clientes;
CREATE TRIGGER clientes_assign_tenant_id
    BEFORE INSERT ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_tenant_id();

DROP TRIGGER IF EXISTS produtos_assign_tenant_id ON public.produtos;
CREATE TRIGGER produtos_assign_tenant_id
    BEFORE INSERT ON public.produtos
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_tenant_id();

DROP TRIGGER IF EXISTS pedidos_assign_tenant_id ON public.pedidos;
CREATE TRIGGER pedidos_assign_tenant_id
    BEFORE INSERT ON public.pedidos
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_tenant_id();

DROP TRIGGER IF EXISTS itens_pedido_assign_tenant_id ON public.itens_pedido;
CREATE TRIGGER itens_pedido_assign_tenant_id
    BEFORE INSERT ON public.itens_pedido
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_tenant_id();

DROP TRIGGER IF EXISTS rotas_assign_tenant_id ON public.rotas;
CREATE TRIGGER rotas_assign_tenant_id
    BEFORE INSERT ON public.rotas
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_tenant_id();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'configuracoes'
    ) THEN
        DROP TRIGGER IF EXISTS configuracoes_assign_tenant_id ON public.configuracoes;
        CREATE TRIGGER configuracoes_assign_tenant_id
            BEFORE INSERT ON public.configuracoes
            FOR EACH ROW
            EXECUTE FUNCTION public.assign_tenant_id();
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'categorias'
    ) THEN
        DROP TRIGGER IF EXISTS categorias_assign_tenant_id ON public.categorias;
        CREATE TRIGGER categorias_assign_tenant_id
            BEFORE INSERT ON public.categorias
            FOR EACH ROW
            EXECUTE FUNCTION public.assign_tenant_id();
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'despesas'
    ) THEN
        DROP TRIGGER IF EXISTS despesas_assign_tenant_id ON public.despesas;
        CREATE TRIGGER despesas_assign_tenant_id
            BEFORE INSERT ON public.despesas
            FOR EACH ROW
            EXECUTE FUNCTION public.assign_tenant_id();
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pagamentos'
    ) THEN
        DROP TRIGGER IF EXISTS pagamentos_assign_tenant_id ON public.pagamentos;
        CREATE TRIGGER pagamentos_assign_tenant_id
            BEFORE INSERT ON public.pagamentos
            FOR EACH ROW
            EXECUTE FUNCTION public.assign_tenant_id();
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notificacoes'
    ) THEN
        DROP TRIGGER IF EXISTS notificacoes_assign_tenant_id ON public.notificacoes;
        CREATE TRIGGER notificacoes_assign_tenant_id
            BEFORE INSERT ON public.notificacoes
            FOR EACH ROW
            EXECUTE FUNCTION public.assign_tenant_id();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
    produto_id UUID,
    nome TEXT,
    quantidade_total INTEGER,
    quantidade_reservada BIGINT,
    quantidade_disponivel BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS produto_id,
        p.nome,
        p.quantidade_total,
        COALESCE(SUM(
            CASE
                WHEN ped.id IS NOT NULL
                     AND ped.status IN ('pago_50', 'entregue')
                     AND ped.data_evento = data_consulta
                THEN ip.quantidade
                ELSE 0
            END
        ), 0)::BIGINT AS quantidade_reservada,
        (p.quantidade_total - COALESCE(SUM(
            CASE
                WHEN ped.id IS NOT NULL
                     AND ped.status IN ('pago_50', 'entregue')
                     AND ped.data_evento = data_consulta
                THEN ip.quantidade
                ELSE 0
            END
        ), 0))::BIGINT AS quantidade_disponivel
    FROM public.produtos p
    LEFT JOIN public.itens_pedido ip
        ON ip.produto_id = p.id
       AND ip.tenant_id = p.tenant_id
    LEFT JOIN public.pedidos ped
        ON ped.id = ip.pedido_id
       AND ped.tenant_id = p.tenant_id
    WHERE p.tenant_id = public.current_tenant_id()
    GROUP BY p.id, p.nome, p.quantidade_total
    ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_access_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
    v_table_name TEXT;
BEGIN
    FOREACH v_table_name IN ARRAY ARRAY[
        'clientes',
        'produtos',
        'pedidos',
        'itens_pedido',
        'rotas',
        'configuracoes',
        'categorias',
        'despesas',
        'pagamentos',
        'notificacoes'
    ]
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = v_table_name
        ) THEN
            FOR policy_record IN
                SELECT policyname
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = v_table_name
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, v_table_name);
            END LOOP;
        END IF;
    END LOOP;
END $$;

CREATE POLICY tenants_select_own
    ON public.tenants
    FOR SELECT
    USING (id = public.current_tenant_id());

CREATE POLICY tenants_update_own
    ON public.tenants
    FOR UPDATE
    USING (id = public.current_tenant_id())
    WITH CHECK (id = public.current_tenant_id());

CREATE POLICY profiles_select_self
    ON public.profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY profiles_update_self
    ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY public_access_tokens_select_own
    ON public.public_access_tokens
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

CREATE POLICY public_access_tokens_insert_own
    ON public.public_access_tokens
    FOR INSERT
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY public_access_tokens_update_own
    ON public.public_access_tokens
    FOR UPDATE
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DO $$
DECLARE
    v_table_name TEXT;
BEGIN
    FOREACH v_table_name IN ARRAY ARRAY[
        'clientes',
        'produtos',
        'pedidos',
        'itens_pedido',
        'rotas',
        'configuracoes',
        'categorias',
        'despesas',
        'pagamentos',
        'notificacoes'
    ]
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = v_table_name
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
                v_table_name || '_tenant_isolation',
                v_table_name
            );
        END IF;
    END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;

COMMIT;
