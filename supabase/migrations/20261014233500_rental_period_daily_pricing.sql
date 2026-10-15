-- Inclusive rental periods, daily pricing, and interval-aware stock checks.

ALTER TABLE public.pedidos
    ADD COLUMN IF NOT EXISTS data_fim_evento DATE;

UPDATE public.pedidos
   SET data_fim_evento = data_evento
 WHERE data_fim_evento IS NULL;

ALTER TABLE public.pedidos
    ALTER COLUMN data_fim_evento SET NOT NULL;

CREATE OR REPLACE FUNCTION public.normalizar_periodo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.data_fim_evento IS NULL
       OR (TG_OP = 'UPDATE'
           AND NEW.data_evento IS DISTINCT FROM OLD.data_evento
           AND NEW.data_fim_evento IS NOT DISTINCT FROM OLD.data_fim_evento
           AND OLD.data_fim_evento = OLD.data_evento) THEN
        NEW.data_fim_evento := NEW.data_evento;
    END IF;
    IF NEW.data_fim_evento < NEW.data_evento THEN
        RAISE EXCEPTION 'A data final não pode ser anterior à data inicial.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_normalizar_periodo ON public.pedidos;
CREATE TRIGGER pedidos_normalizar_periodo
BEFORE INSERT OR UPDATE OF data_evento, data_fim_evento ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.normalizar_periodo_pedido();

CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_status_periodo
    ON public.pedidos (tenant_id, status, data_evento, data_fim_evento);

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
    v_diarias INTEGER;
BEGIN
    SELECT COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0),
           COALESCE(SUM(ip.quantidade * ip.preco_unitario)
               FILTER (WHERE p_desconto_escopo <> 'produto' OR ip.produto_id = p_desconto_produto_id), 0),
           COALESCE(p.frete, 0),
           (p.data_fim_evento - p.data_evento + 1)::INTEGER
      INTO v_itens, v_escopo, v_frete, v_diarias
      FROM public.pedidos p
      LEFT JOIN public.itens_pedido ip ON ip.pedido_id = p.id AND ip.tenant_id = p.tenant_id
     WHERE p.id = p_pedido_id AND p.tenant_id = public.current_tenant_id()
     GROUP BY p.id, p.frete, p.data_evento, p.data_fim_evento;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002';
    END IF;

    v_itens := v_itens * v_diarias;
    v_escopo := v_escopo * v_diarias;
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

CREATE OR REPLACE FUNCTION public.calcular_disponibilidade_periodo(
    p_data_inicio DATE,
    p_data_fim DATE
) RETURNS TABLE (
    produto_id UUID,
    nome TEXT,
    quantidade_total INTEGER,
    quantidade_reservada BIGINT,
    quantidade_disponivel BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_fim < p_data_inicio THEN
        RAISE EXCEPTION 'Informe um período válido.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    WITH dias AS (
        SELECT generate_series(p_data_inicio, p_data_fim, INTERVAL '1 day')::DATE AS dia
    ), ocupacao AS (
        SELECT ip.produto_id, d.dia, SUM(ip.quantidade)::BIGINT AS quantidade
          FROM dias d
          JOIN public.pedidos ped
            ON ped.data_evento <= d.dia
           AND (ped.data_fim_evento >= d.dia OR ped.data_fim_evento < CURRENT_DATE)
           AND ped.status IN ('assinado', 'pago_50', 'entregue')
          JOIN public.itens_pedido ip ON ip.pedido_id = ped.id AND ip.tenant_id = ped.tenant_id
         WHERE ped.tenant_id = public.current_tenant_id()
         GROUP BY ip.produto_id, d.dia
    ), max_ocupacao AS (
        SELECT produto_id, MAX(quantidade)::BIGINT AS quantidade
          FROM ocupacao
         GROUP BY produto_id
    )
    SELECT p.id, p.nome, p.quantidade_total,
           COALESCE(o.quantidade, 0),
           p.quantidade_total::BIGINT - COALESCE(o.quantidade, 0)
      FROM public.produtos p
      LEFT JOIN max_ocupacao o ON o.produto_id = p.id
     WHERE p.tenant_id = public.current_tenant_id()
     ORDER BY p.nome;
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
    SELECT * FROM public.calcular_disponibilidade_periodo(data_consulta, data_consulta);
$$;

CREATE OR REPLACE FUNCTION public.validar_estoque_periodo_pedido(
    p_data_inicio DATE,
    p_data_fim DATE,
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
    IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_fim < p_data_inicio THEN
        RAISE EXCEPTION 'A data final não pode ser anterior à data inicial.' USING ERRCODE = '22023';
    END IF;
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
        SELECT COALESCE(MAX(ocupacao.quantidade), 0)::BIGINT INTO v_reservado
          FROM (
              SELECT d.dia, SUM(ip.quantidade)::BIGINT AS quantidade
                FROM generate_series(p_data_inicio, p_data_fim, INTERVAL '1 day') d(dia)
                JOIN public.pedidos ped
                  ON ped.data_evento <= d.dia::DATE
                 AND (ped.data_fim_evento >= d.dia::DATE OR ped.data_fim_evento < CURRENT_DATE)
                 AND ped.status IN ('assinado', 'pago_50', 'entregue')
                JOIN public.itens_pedido ip ON ip.pedido_id = ped.id AND ip.tenant_id = ped.tenant_id
               WHERE ped.tenant_id = v_tenant
                 AND ip.produto_id = v_item.produto_id
                 AND (p_pedido_ignorado IS NULL OR ped.id <> p_pedido_ignorado)
               GROUP BY d.dia
          ) ocupacao;
        IF v_item.quantidade + v_reservado > v_total THEN
            RAISE EXCEPTION 'Estoque insuficiente no período para um produto. Disponível: %; solicitado: %.',
                GREATEST(v_total - v_reservado, 0), v_item.quantidade USING ERRCODE = '23514';
        END IF;
    END LOOP;
END;
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
BEGIN
    PERFORM public.validar_estoque_periodo_pedido(p_data_evento, p_data_evento, p_itens, p_pedido_ignorado, p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_pedido_periodo_transacional(
    p_cliente_id UUID,
    p_data_evento DATE,
    p_data_fim_evento DATE,
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
    v_pedido_id UUID;
    v_total NUMERIC;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(public.current_tenant_id()::TEXT), 71001);
    PERFORM public.validar_estoque_periodo_pedido(p_data_evento, p_data_fim_evento, p_itens, NULL);
    v_pedido_id := public.criar_pedido_transacional(
        p_cliente_id, p_data_evento, p_hora_entrega, p_observacoes, p_frete,
        p_distancia_km, p_usar_endereco_residencial, p_endereco_evento,
        p_itens, p_pagamento_valor, p_pagamento_metodo
    );
    UPDATE public.pedidos
       SET data_fim_evento = p_data_fim_evento
     WHERE id = v_pedido_id AND tenant_id = public.current_tenant_id();
    v_total := public.calcular_total_pedido(v_pedido_id);
    UPDATE public.pedidos SET total_pedido = v_total
     WHERE id = v_pedido_id AND tenant_id = public.current_tenant_id();
    RETURN v_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_pedido_periodo_transacional(
    p_pedido_id UUID,
    p_data_evento DATE,
    p_data_fim_evento DATE,
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
    v_pedido public.pedidos%ROWTYPE;
    v_total NUMERIC;
BEGIN
    IF public.current_tenant_id() IS NULL THEN RAISE EXCEPTION 'Sessão sem conta ativa.' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(public.current_tenant_id()::TEXT), 71001);
    SELECT * INTO v_pedido FROM public.pedidos
     WHERE id = p_pedido_id AND tenant_id = public.current_tenant_id() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou sem acesso.' USING ERRCODE = 'P0002'; END IF;
    IF v_pedido.status IN ('assinado', 'pago_50', 'entregue') THEN
        PERFORM public.validar_estoque_periodo_pedido(p_data_evento, p_data_fim_evento, p_itens, p_pedido_id);
    END IF;
    UPDATE public.pedidos
       SET data_evento = p_data_evento, data_fim_evento = p_data_fim_evento
     WHERE id = p_pedido_id AND tenant_id = public.current_tenant_id();
    PERFORM public.editar_pedido_transacional(
        p_pedido_id, p_data_evento, p_hora_entrega, p_observacoes,
        p_usar_endereco_residencial, p_endereco_evento, p_itens
    );
    v_total := public.calcular_total_pedido(
        p_pedido_id, v_pedido.desconto_tipo, v_pedido.desconto_valor,
        v_pedido.desconto_escopo, v_pedido.desconto_produto_id
    );
    UPDATE public.pedidos SET total_pedido = v_total
     WHERE id = p_pedido_id AND tenant_id = public.current_tenant_id();
    RETURN v_total;
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
        PERFORM public.validar_estoque_periodo_pedido(v_pedido.data_evento, v_pedido.data_fim_evento, v_itens, p_pedido_id);
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
      INTO v_itens FROM public.itens_pedido ip
     WHERE ip.pedido_id = p_pedido_id AND ip.tenant_id = v_tenant;
    PERFORM public.validar_estoque_periodo_pedido(
        v_pedido.data_evento, v_pedido.data_fim_evento, v_itens, p_pedido_id, v_tenant
    );
    UPDATE public.pedidos SET status = 'assinado', assinatura_url = p_assinatura_url
     WHERE id = p_pedido_id AND tenant_id = v_tenant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_disponibilidade_periodo(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_estoque_periodo_pedido(DATE, DATE, JSONB, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_periodo_transacional(UUID, DATE, DATE, TIME, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_pedido_periodo_transacional(UUID, DATE, DATE, TIME, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_pedido_transacional(UUID, public.status_pedido) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_pedido_transacional(UUID, TEXT, UUID) TO authenticated, service_role;
