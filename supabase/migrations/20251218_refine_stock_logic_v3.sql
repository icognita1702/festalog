-- =============================================
-- MIGRATION: Refinar regras de estoque (V3)
-- DATA: 2025-12-18
-- DESCRIÇÃO: 
-- Atualiza as regras de disponibilidade conforme solicitação:
-- 1. Estoque só é consumido quando status for 'pago_50' ou 'entregue'.
--    (Ignora 'assinado', 'orcamento', 'contrato_enviado').
-- 2. Estoque é liberado IMEDIATAMENTE quando status for 'recolhido' ou 'finalizado'.
-- 3. Mantém a correção de datas: pedidos futuros não bloqueiam outros dias futuros,
--    mas pedidos PASSADOS (atrasados) continuam bloqueando até serem devolvidos.
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
    -- REGRA DE STATUS:
    -- Só subtrai do estoque se tiver pago sinal (pago_50) ou já estiver entregue.
    -- Se estiver 'recolhido', 'finalizado', 'orcamento', 'assinado', NÃO conta.
    AND ped.status IN ('pago_50', 'entregue') 
    
    -- REGRA DE DATA:
    AND (
       -- 1. É um agendamento para o dia exato da consulta
       ped.data_evento = data_consulta
       OR
       -- 2. É um pedido antigo (anterior a hoje) que ainda está com status 'pago_50' ou 'entregue'
       --    Isso significa que não foi devolvido (ou status não atualizado), então bloqueia estoque.
       (ped.data_evento < CURRENT_DATE AND ped.data_evento <= data_consulta)
    )
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;
