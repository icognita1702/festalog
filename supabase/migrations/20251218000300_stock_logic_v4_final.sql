-- =============================================
-- MIGRATION: Lógica FINAL de disponibilidade de estoque (V4)
-- DATA: 2025-12-18
-- VERSÃO: 4.0
-- =============================================
-- REGRAS:
-- 1. Ao consultar disponibilidade para o dia X:
--    a) Mostra itens reservados EXATAMENTE para o dia X (com status pago_50 ou entregue)
--    b) Mostra itens de dias ANTERIORES A HOJE que ainda não foram devolvidos
-- 2. Pedidos FUTUROS (após hoje) NÃO bloqueiam uns aos outros
-- 3. Status que BLOQUEIAM estoque: pago_50, entregue
-- 4. Status que LIBERAM estoque: orcamento, contrato_enviado, assinado, recolhido, finalizado
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
    COALESCE(SUM(ip.quantidade), 0)::BIGINT as quantidade_reservada,
    (p.quantidade_total - COALESCE(SUM(ip.quantidade), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id 
    -- Apenas status que bloqueiam estoque
    AND ped.status IN ('pago_50', 'entregue')
    -- Lógica de datas:
    AND (
       -- Caso 1: É exatamente o dia que estou consultando
       ped.data_evento = data_consulta
       
       -- Caso 2: É um pedido ATRASADO (anterior a hoje) que não foi devolvido
       -- Exemplo: Hoje é 18/12, pedido do dia 15/12 com status 'entregue' = BLOQUEIA
       OR (ped.data_evento < hoje)
    )
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;

-- Verificação: Você pode testar a função assim:
-- SELECT * FROM calcular_disponibilidade('2025-12-31');
