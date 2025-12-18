-- =============================================
-- MIGRATION: Atualizar lógica de disponibilidade de estoque
-- DATA: 2025-12-18
-- DESCRIÇÃO: 
-- Altera a função calcular_disponibilidade para considerar não apenas
-- os pedidos do dia exato, mas todos os pedidos passados que ainda
-- não foram finalizados (status != 'finalizado' e != 'orcamento').
-- Isso garante que itens não devolvidos continuem ocupando estoque.
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
    -- Mudança principal aqui: data_evento <= data_consulta
    -- Pega tudo que aconteceu até hoje (ou a data consultada)
    AND ped.data_evento <= data_consulta
    -- E que ainda não foi finalizado (se foi finalizado, voltou pro estoque)
    -- Também ignoramos orçamentos para não travar estoque sem confirmação (opcional, ajustável)
    AND ped.status NOT IN ('orcamento', 'finalizado')
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;
