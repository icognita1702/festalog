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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
        SELECT oc.produto_id, MAX(oc.quantidade)::BIGINT AS quantidade
          FROM ocupacao oc
         GROUP BY oc.produto_id
    )
    SELECT p.id AS produto_id,
           p.nome,
           p.quantidade_total,
           COALESCE(o.quantidade, 0)::BIGINT AS quantidade_reservada,
           (p.quantidade_total::BIGINT - COALESCE(o.quantidade, 0))::BIGINT AS quantidade_disponivel
      FROM public.produtos p
      LEFT JOIN max_ocupacao o ON o.produto_id = p.id
     WHERE p.tenant_id = public.current_tenant_id()
     ORDER BY p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_disponibilidade_periodo(DATE, DATE) TO authenticated;
