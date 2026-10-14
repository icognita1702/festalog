-- Atomic order edits, discounts, payment history synchronization, and stock reservations.

ALTER TABLE public.pedidos
    ADD COLUMN IF NOT EXISTS desconto_tipo TEXT,
    ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS desconto_escopo TEXT,
    ADD COLUMN IF NOT EXISTS desconto_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_desconto_tipo_check') THEN
        ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_desconto_tipo_check
            CHECK (desconto_tipo IS NULL OR desconto_tipo IN ('percentual', 'valor', 'preco_final'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_desconto_escopo_check') THEN
        ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_desconto_escopo_check
            CHECK (desconto_escopo IS NULL OR desconto_escopo IN ('pedido', 'produto'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_status_data
    ON public.pedidos (tenant_id, status, data_evento);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_tenant_pedido_produto
    ON public.itens_pedido (tenant_id, pedido_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_tenant_produto_pedido
    ON public.itens_pedido (tenant_id, produto_id, pedido_id);

-- Totals are now calculated by the transactional RPCs, which include freight and discount.
DROP TRIGGER IF EXISTS trigger_atualizar_total ON public.itens_pedido;

-- Preserve legacy amounts that were saved only in pedidos.valor_pago before payment history was complete.
INSERT INTO public.pagamentos (pedido_id, valor, metodo, observacao, data_pagamento)
SELECT p.id,
       ROUND(p.valor_pago - COALESCE(SUM(pg.valor), 0), 2),
       'legado',
       'Valor recebido antes do histórico de pagamentos ser sincronizado.',
       COALESCE(p.created_at::DATE, CURRENT_DATE)
  FROM public.pedidos p
  LEFT JOIN public.pagamentos pg ON pg.pedido_id = p.id
 WHERE p.valor_pago > 0
 GROUP BY p.id, p.valor_pago, p.created_at
HAVING p.valor_pago > COALESCE(SUM(pg.valor), 0) + 0.005;

UPDATE public.pedidos p
   SET valor_pago = COALESCE((SELECT SUM(pg.valor) FROM public.pagamentos pg WHERE pg.pedido_id = p.id), 0)
 WHERE p.valor_pago IS DISTINCT FROM COALESCE((SELECT SUM(pg.valor) FROM public.pagamentos pg WHERE pg.pedido_id = p.id), 0);

CREATE OR REPLACE FUNCTION public.calcular_total_pedido(
    p_pedido_id UUID,
    p_desconto_tipo TEXT DEFAULT NULL,
    p_desconto_valor NUMERIC DEFAULT NULL,
    p_desconto_escopo TEXT DEFAULT NULL,
    p_desconto_produto_id UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_itens NUMERIC;
    v_escopo NUMERIC;
    v_frete NUMERIC;
    v_desconto NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0),
           COALESCE(SUM(ip.quantidade * ip.preco_unitario)
               FILTER (WHERE p_desconto_escopo <> 'produto' OR ip.produto_id = p_desconto_produto_id), 0),
           COALESCE(p.frete, 0)
      INTO v_itens, v_escopo, v_frete
      FROM public.pedidos p
      LEFT JOIN public.itens_pedido ip ON ip.pedido_id = p.id AND ip.tenant_id = p.tenant_id
     WHERE p.id = p_pedido_id AND p.tenant_id = public.current_tenant_id()
     GROUP BY p.id, p.frete;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002';
    END IF;

    IF p_desconto_tipo IS NULL THEN
        RETURN ROUND(v_itens + v_frete, 2);
    END IF;
    IF p_desconto_tipo NOT IN ('percentual', 'valor', 'preco_final')
       OR p_desconto_escopo NOT IN ('pedido', 'produto')
       OR p_desconto_valor IS NULL OR p_desconto_valor < 0 THEN
        RAISE EXCEPTION 'Dados do desconto inválidos.' USING ERRCODE = '22023';
    END IF;
    IF p_desconto_escopo = 'produto' AND NOT EXISTS (
        SELECT 1 FROM public.itens_pedido ip
         WHERE ip.pedido_id = p_pedido_id
           AND ip.tenant_id = public.current_tenant_id()
           AND ip.produto_id = p_desconto_produto_id
    ) THEN
        RAISE EXCEPTION 'O produto escolhido para o desconto não está neste pedido.' USING ERRCODE = '22023';
    END IF;

    IF p_desconto_escopo = 'pedido' THEN
        v_escopo := v_itens + v_frete;
    END IF;

    IF p_desconto_tipo = 'percentual' THEN
        IF p_desconto_valor > 100 THEN
            RAISE EXCEPTION 'O desconto percentual deve ficar entre 0 e 100.' USING ERRCODE = '22023';
        END IF;
        v_desconto := v_escopo * p_desconto_valor / 100;
    ELSIF p_desconto_tipo = 'valor' THEN
        v_desconto := p_desconto_valor;
    ELSE
        IF p_desconto_valor > v_escopo THEN
            RAISE EXCEPTION 'O preço final não pode superar o valor do escopo.' USING ERRCODE = '22023';
        END IF;
        v_desconto := v_escopo - p_desconto_valor;
    END IF;

    IF v_desconto > v_escopo THEN
        RAISE EXCEPTION 'O desconto não pode superar o valor dos itens selecionados.' USING ERRCODE = '22023';
    END IF;
    RETURN ROUND(v_itens + v_frete - v_desconto, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
    produto_id UUID,
    nome TEXT,
    quantidade_total INTEGER,
    quantidade_reservada BIGINT,
    quantidade_disponivel BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH reservados AS (
        SELECT ip.produto_id, SUM(ip.quantidade)::BIGINT AS quantidade
          FROM public.itens_pedido ip
          JOIN public.pedidos ped
            ON ped.id = ip.pedido_id AND ped.tenant_id = ip.tenant_id
         WHERE ip.tenant_id = public.current_tenant_id()
           AND ped.status IN ('assinado', 'pago_50', 'entregue')
           AND ped.data_evento <= data_consulta
         GROUP BY ip.produto_id
    )
    SELECT p.id, p.nome, p.quantidade_total,
           COALESCE(r.quantidade, 0),
           p.quantidade_total::BIGINT - COALESCE(r.quantidade, 0)
      FROM public.produtos p
      LEFT JOIN reservados r ON r.produto_id = p.id
     WHERE p.tenant_id = public.current_tenant_id()
     ORDER BY p.nome;
$$;

CREATE OR REPLACE FUNCTION public.validar_estoque_pedido(
    p_data_evento DATE,
    p_itens JSONB,
    p_pedido_ignorado UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID := COALESCE(public.current_tenant_id(), p_tenant_id);
    v_item RECORD;
    v_total INTEGER;
    v_reservado BIGINT;
BEGIN
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sessão sem conta ativa.' USING ERRCODE = '42501'; END IF;
    IF p_itens IS NULL OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'Adicione pelo menos um produto ao pedido.' USING ERRCODE = '22023';
    END IF;
    IF auth.uid() IS NOT NULL AND p_tenant_id IS NOT NULL AND p_tenant_id <> public.current_tenant_id() THEN
        RAISE EXCEPTION 'Conta inválida para validar o estoque.' USING ERRCODE = '42501';
    END IF;
    FOR v_item IN
        SELECT (value->>'produto_id')::UUID AS produto_id,
               SUM((value->>'quantidade')::INTEGER)::INTEGER AS quantidade
          FROM jsonb_array_elements(p_itens)
         GROUP BY (value->>'produto_id')::UUID
    LOOP
        SELECT p.quantidade_total INTO v_total
          FROM public.produtos p
         WHERE p.id = v_item.produto_id AND p.tenant_id = v_tenant
         FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Um produto do pedido não foi encontrado ou não está disponível para esta conta.' USING ERRCODE = '22023';
        END IF;

        SELECT COALESCE(SUM(ip.quantidade), 0)::BIGINT INTO v_reservado
          FROM public.itens_pedido ip
          JOIN public.pedidos ped ON ped.id = ip.pedido_id AND ped.tenant_id = ip.tenant_id
         WHERE ip.produto_id = v_item.produto_id
           AND ip.tenant_id = v_tenant
           AND ped.status IN ('assinado', 'pago_50', 'entregue')
           AND ped.data_evento <= p_data_evento
           AND (p_pedido_ignorado IS NULL OR ped.id <> p_pedido_ignorado);
        IF v_item.quantidade + v_reservado > v_total THEN
            RAISE EXCEPTION 'Estoque insuficiente para um produto na data escolhida. Disponível: %; solicitado: %.',
                GREATEST(v_total - v_reservado, 0), v_item.quantidade USING ERRCODE = '23514';
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_pedido_transacional(
    p_pedido_id UUID,
    p_data_evento DATE,
    p_hora_entrega TIME,
    p_observacoes TEXT,
    p_usar_endereco_residencial BOOLEAN,
    p_endereco_evento TEXT,
    p_itens JSONB
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID := public.current_tenant_id();
    v_pedido public.pedidos%ROWTYPE;
    v_item JSONB;
    v_item_id UUID;
    v_produto_id UUID;
    v_quantidade INTEGER;
    v_preco NUMERIC;
    v_total NUMERIC;
BEGIN
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sessão sem conta ativa.' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant::TEXT), 71001);
    SELECT * INTO v_pedido FROM public.pedidos
     WHERE id = p_pedido_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002'; END IF;
    IF p_itens IS NULL OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'Adicione pelo menos um produto ao pedido.' USING ERRCODE = '22023';
    END IF;

    IF v_pedido.status IN ('assinado', 'pago_50', 'entregue') THEN
        PERFORM public.validar_estoque_pedido(p_data_evento, p_itens, p_pedido_id);
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_id := NULLIF(v_item->>'id', '')::UUID;
        v_produto_id := (v_item->>'produto_id')::UUID;
        v_quantidade := (v_item->>'quantidade')::INTEGER;
        v_preco := (v_item->>'preco_unitario')::NUMERIC;
        IF v_quantidade < 1 OR v_preco < 0 THEN RAISE EXCEPTION 'Quantidade ou preço inválido.' USING ERRCODE = '22023'; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = v_produto_id AND p.tenant_id = v_tenant) THEN
            RAISE EXCEPTION 'Produto não encontrado ou sem acesso.' USING ERRCODE = '22023';
        END IF;
        IF v_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.itens_pedido ip WHERE ip.id = v_item_id AND ip.pedido_id = p_pedido_id AND ip.tenant_id = v_tenant
        ) THEN RAISE EXCEPTION 'Um item enviado para edição não pertence a este pedido.' USING ERRCODE = '22023'; END IF;
    END LOOP;

    DELETE FROM public.itens_pedido ip
     WHERE ip.pedido_id = p_pedido_id AND ip.tenant_id = v_tenant
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) x WHERE NULLIF(x->>'id', '')::UUID = ip.id);

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_id := NULLIF(v_item->>'id', '')::UUID;
        IF v_item_id IS NULL THEN
            INSERT INTO public.itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
            VALUES (p_pedido_id, (v_item->>'produto_id')::UUID, (v_item->>'quantidade')::INTEGER, (v_item->>'preco_unitario')::NUMERIC);
        ELSE
            UPDATE public.itens_pedido
               SET produto_id = (v_item->>'produto_id')::UUID,
                   quantidade = (v_item->>'quantidade')::INTEGER,
                   preco_unitario = (v_item->>'preco_unitario')::NUMERIC
             WHERE id = v_item_id AND pedido_id = p_pedido_id AND tenant_id = v_tenant;
        END IF;
    END LOOP;

    UPDATE public.pedidos
       SET data_evento = p_data_evento,
           hora_entrega = p_hora_entrega,
           observacoes = p_observacoes,
           usar_endereco_residencial = p_usar_endereco_residencial,
           endereco_evento = CASE WHEN p_usar_endereco_residencial THEN NULL ELSE p_endereco_evento END
     WHERE id = p_pedido_id AND tenant_id = v_tenant;

    IF v_pedido.desconto_escopo = 'produto' AND NOT EXISTS (
        SELECT 1 FROM public.itens_pedido ip
         WHERE ip.pedido_id = p_pedido_id
           AND ip.tenant_id = v_tenant
           AND ip.produto_id = v_pedido.desconto_produto_id
    ) THEN
        UPDATE public.pedidos
           SET desconto_tipo = NULL,
               desconto_valor = NULL,
               desconto_escopo = NULL,
               desconto_produto_id = NULL
         WHERE id = p_pedido_id AND tenant_id = v_tenant;
        v_pedido.desconto_tipo := NULL;
        v_pedido.desconto_valor := NULL;
        v_pedido.desconto_escopo := NULL;
        v_pedido.desconto_produto_id := NULL;
    END IF;

    v_total := public.calcular_total_pedido(p_pedido_id, v_pedido.desconto_tipo, v_pedido.desconto_valor, v_pedido.desconto_escopo, v_pedido.desconto_produto_id);
    UPDATE public.pedidos SET total_pedido = v_total WHERE id = p_pedido_id AND tenant_id = v_tenant;
    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_pedido_transacional(
    p_cliente_id UUID,
    p_data_evento DATE,
    p_hora_entrega TIME,
    p_observacoes TEXT,
    p_frete NUMERIC,
    p_distancia_km NUMERIC,
    p_usar_endereco_residencial BOOLEAN,
    p_endereco_evento TEXT,
    p_itens JSONB,
    p_pagamento_valor NUMERIC DEFAULT 0,
    p_pagamento_metodo TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID := public.current_tenant_id();
    v_pedido_id UUID;
    v_total NUMERIC;
    v_item JSONB;
BEGIN
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sessão sem conta ativa.' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant::TEXT), 71001);
    IF p_itens IS NULL OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'Adicione pelo menos um produto ao pedido.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant) THEN
        RAISE EXCEPTION 'Cliente não encontrado ou sem acesso.' USING ERRCODE = '22023';
    END IF;
    PERFORM public.validar_estoque_pedido(p_data_evento, p_itens, NULL);
    INSERT INTO public.pedidos (cliente_id, data_evento, hora_entrega, observacoes, frete, distancia_km, usar_endereco_residencial, endereco_evento, total_pedido)
    VALUES (p_cliente_id, p_data_evento, p_hora_entrega, p_observacoes, COALESCE(p_frete, 0), COALESCE(p_distancia_km, 0), p_usar_endereco_residencial,
            CASE WHEN p_usar_endereco_residencial THEN NULL ELSE p_endereco_evento END, 0)
    RETURNING id INTO v_pedido_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
    LOOP
        IF (v_item->>'quantidade')::INTEGER < 1 OR (v_item->>'preco_unitario')::NUMERIC < 0 THEN
            RAISE EXCEPTION 'Quantidade ou preço inválido.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
        VALUES (v_pedido_id, (v_item->>'produto_id')::UUID, (v_item->>'quantidade')::INTEGER, (v_item->>'preco_unitario')::NUMERIC);
    END LOOP;
    v_total := public.calcular_total_pedido(v_pedido_id);
    UPDATE public.pedidos SET total_pedido = v_total WHERE id = v_pedido_id;
    IF COALESCE(p_pagamento_valor, 0) > 0 THEN
        INSERT INTO public.pagamentos (pedido_id, valor, metodo, data_pagamento)
        VALUES (v_pedido_id, p_pagamento_valor, p_pagamento_metodo, CURRENT_DATE);
    END IF;
    IF COALESCE(p_pagamento_valor, 0) < 0 THEN
        RAISE EXCEPTION 'O pagamento inicial não pode ser negativo.' USING ERRCODE = '22023';
    END IF;
    RETURN v_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_pedido_transacional(
    p_pedido_id UUID,
    p_status public.status_pedido
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID := public.current_tenant_id();
    v_pedido public.pedidos%ROWTYPE;
    v_itens JSONB;
BEGIN
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sessão sem conta ativa.' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant::TEXT), 71001);
    SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002'; END IF;
    IF p_status IN ('assinado', 'pago_50', 'entregue') AND v_pedido.status NOT IN ('assinado', 'pago_50', 'entregue') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id', ip.produto_id, 'quantidade', ip.quantidade)), '[]'::JSONB)
          INTO v_itens FROM public.itens_pedido ip WHERE ip.pedido_id = p_pedido_id AND ip.tenant_id = v_tenant;
        PERFORM public.validar_estoque_pedido(v_pedido.data_evento, v_itens, p_pedido_id);
    END IF;
    UPDATE public.pedidos SET status = p_status WHERE id = p_pedido_id AND tenant_id = v_tenant;
END;
$$;

CREATE OR REPLACE FUNCTION public.assinar_pedido_transacional(
    p_pedido_id UUID,
    p_assinatura_url TEXT,
    p_tenant_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID := COALESCE(public.current_tenant_id(), p_tenant_id);
    v_pedido public.pedidos%ROWTYPE;
    v_itens JSONB;
BEGIN
    IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Sessão sem permissão para assinar este pedido.' USING ERRCODE = '42501';
    END IF;
    IF auth.uid() IS NOT NULL AND p_tenant_id IS NOT NULL AND p_tenant_id <> public.current_tenant_id() THEN
        RAISE EXCEPTION 'Conta inválida para assinar este pedido.' USING ERRCODE = '42501';
    END IF;
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Conta do pedido não identificada.' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant::TEXT), 71001);
    SELECT * INTO v_pedido FROM public.pedidos
     WHERE id = p_pedido_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id', ip.produto_id, 'quantidade', ip.quantidade)), '[]'::JSONB)
      INTO v_itens FROM public.itens_pedido ip WHERE ip.pedido_id = p_pedido_id AND ip.tenant_id = v_tenant;
    PERFORM public.validar_estoque_pedido(v_pedido.data_evento, v_itens, p_pedido_id, v_tenant);
    UPDATE public.pedidos SET status = 'assinado', assinatura_url = p_assinatura_url
     WHERE id = p_pedido_id AND tenant_id = v_tenant;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_com_desconto(
    p_pedido_id UUID,
    p_valor NUMERIC,
    p_metodo TEXT,
    p_observacao TEXT,
    p_data_pagamento DATE,
    p_desconto_tipo TEXT,
    p_desconto_valor NUMERIC,
    p_desconto_escopo TEXT,
    p_desconto_produto_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Informe um valor de pagamento válido.' USING ERRCODE = '22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(public.current_tenant_id()::TEXT), 71002);
    PERFORM 1 FROM public.pedidos WHERE id = p_pedido_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002'; END IF;
    v_total := public.calcular_total_pedido(p_pedido_id, p_desconto_tipo, p_desconto_valor, p_desconto_escopo, p_desconto_produto_id);
    UPDATE public.pedidos
       SET desconto_tipo = p_desconto_tipo,
           desconto_valor = CASE WHEN p_desconto_tipo IS NULL THEN NULL ELSE p_desconto_valor END,
           desconto_escopo = CASE WHEN p_desconto_tipo IS NULL THEN NULL ELSE p_desconto_escopo END,
           desconto_produto_id = CASE WHEN p_desconto_tipo IS NULL OR p_desconto_escopo <> 'produto' THEN NULL ELSE p_desconto_produto_id END,
           total_pedido = v_total
     WHERE id = p_pedido_id AND tenant_id = public.current_tenant_id();
    INSERT INTO public.pagamentos (pedido_id, valor, metodo, observacao, data_pagamento)
    VALUES (p_pedido_id, p_valor, p_metodo, NULLIF(p_observacao, ''), p_data_pagamento);
    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_valor_pago_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido_id UUID := COALESCE(NEW.pedido_id, OLD.pedido_id);
    v_tenant_id UUID := COALESCE(NEW.tenant_id, OLD.tenant_id);
BEGIN
    UPDATE public.pedidos p
       SET valor_pago = COALESCE((
           SELECT SUM(pg.valor) FROM public.pagamentos pg
            WHERE pg.pedido_id = v_pedido_id AND pg.tenant_id = v_tenant_id
       ), 0)
     WHERE p.id = v_pedido_id AND p.tenant_id = v_tenant_id;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pagamentos_sincronizar_valor_pago ON public.pagamentos;
CREATE TRIGGER pagamentos_sincronizar_valor_pago
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_valor_pago_pedido();

GRANT EXECUTE ON FUNCTION public.calcular_total_pedido(UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_estoque_pedido(DATE, JSONB, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editar_pedido_transacional(UUID, DATE, TIME, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_transacional(UUID, DATE, TIME, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_pedido_transacional(UUID, public.status_pedido) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_pedido_transacional(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_com_desconto(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, NUMERIC, TEXT, UUID) TO authenticated;

