


















































































-- =============================================
-- MIGRATION: Corrigir sobreposição de datas futuras
-- DATA: 2025-12-18
-- DESCRIÇÃO: 
-- Ajusta a lógica para evitar que um pedido futuro (ex: 2025) 
-- bloqueie datas subsequentes também futuras.
-- O bloqueio "contínuo" só deve ocorrer para pedidos que já
-- aconteceram (passado/atrasados) e ainda não foram finalizados.
-- =============================================

CREATE OR REPLACE FUNCTION calcular_disponibilidade(data_consulta DATE)
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
    p.id as produto_id,
    p.nome,
    p.quantidade_total,
    COALESCE(SUM(ip.quantidade), 0)::BIGINT as quantidade_reservada,
    (p.quantidade_total - COALESCE(SUM(ip.quantidade), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id 
    AND ped.status NOT IN ('orcamento', 'finalizado')
    -- LÓGICA REFINADA:
    -- O pedido conta como "reservado" se:
    -- 1. For EXATAMENTE na data consultada (reserva agendada)
    -- OU
    -- 2. For ANTERIOR a hoje (atrasado/não devolvido) E anterior ou igual à consulta
    AND (
       ped.data_evento = data_consulta
       OR
       (ped.data_evento < CURRENT_DATE AND ped.data_evento <= data_consulta)
    )
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;
