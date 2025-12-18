-- =============================================
-- MIGRATION: Lógica CORRIGIDA de disponibilidade (V5)
-- DATA: 2025-12-18
-- BUG CORRIGIDO: O SUM estava contando todos os itens_pedido,
-- ignorando o filtro de status do pedido.
-- SOLUÇÃO: Usar CASE WHEN para só somar quando o pedido corresponde.
-- =============================================

DROP FUNCTION IF EXISTS calcular_disponibilidade(DATE);

CREATE OR REPLACE FUNCTION calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
  produto_id UUID,
  nome TEXT,
  quantidade_total INTEGER,
  quantidade_reservada BIGINT,
  quantidade_disponivel BIGINT
) AS $$
DECLARE
  hoje DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT 
    p.id as produto_id,
    p.nome,
    p.quantidade_total,
    -- CORREÇÃO: Só soma quantidade quando o pedido existe E corresponde aos critérios
    COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0)::BIGINT as quantidade_reservada,
    -- Disponível = Total - Reservada
    (p.quantidade_total - COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;

-- Teste imediato:
-- SELECT * FROM calcular_disponibilidade('2025-12-18');
-- Agora DEVE retornar quantidade_reservada = 0 para todos os produtos!
