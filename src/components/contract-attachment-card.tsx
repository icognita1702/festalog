'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface ContractAttachmentCardProps {
  pedidoId: string
  onContractChange?: (hasContract: boolean, url?: string) => void
}

interface ContractInfo {
  name: string
  url: string
  size?: number
  updatedAt?: string
}

export function ContractAttachmentCard({ pedidoId, onContractChange }: ContractAttachmentCardProps) {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [contract, setContract] = useState<ContractInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const folderPath = `pedidos/${pedidoId}`
  const filePath = `${folderPath}/contrato.pdf`

  async function checkContract() {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage.from('contratos').list(folderPath)

      if (error) {
        console.error('Erro ao verificar contrato anexado:', error)
        setContract(null)
        onContractChange?.(false)
        return
      }

      const contractFile = data?.find(
        (f) => f.name === 'contrato.pdf' || f.name.toLowerCase().endsWith('.pdf')
      )

      if (contractFile) {
        const fullPath = `${folderPath}/${contractFile.name}`
        const { data: urlData } = supabase.storage.from('contratos').getPublicUrl(fullPath)

        const info: ContractInfo = {
          name: contractFile.name,
          url: urlData?.publicUrl || '',
          size: contractFile.metadata?.size,
          updatedAt: contractFile.updated_at || contractFile.created_at,
        }
        setContract(info)
        onContractChange?.(true, info.url)
      } else {
        setContract(null)
        onContractChange?.(false)
      }
    } catch (err) {
      console.error('Erro:', err)
      setContract(null)
      onContractChange?.(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pedidoId) {
      checkContract()
    }
  }, [pedidoId])

  async function handleFileUpload(file: File) {
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo em formato PDF (.pdf).')
      return
    }

    setUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from('contratos')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadError) throw uploadError

      await checkContract()
    } catch (err: any) {
      console.error('Erro ao fazer upload do contrato:', err)
      alert(`Falha ao anexar contrato: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!confirm('Deseja realmente remover o contrato anexado deste pedido?')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.storage.from('contratos').remove([filePath])
      if (error) throw error

      setContract(null)
      onContractChange?.(false)
    } catch (err: any) {
      console.error('Erro ao remover contrato:', err)
      alert(`Erro ao remover contrato: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setLoading(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  function formatFileSize(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Contrato Anexado
            </CardTitle>
            <CardDescription>Anexe o PDF pronto do seu contrato</CardDescription>
          </div>
          {contract && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Anexado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contract ? (
          /* Estado: Contrato Anexado */
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-foreground">
                  {contract.name}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                  {contract.size && <span>{formatFileSize(contract.size)}</span>}
                  {contract.updatedAt && (
                    <span>
                      Atualizado em {format(new Date(contract.updatedAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(contract.url, '_blank')}
              >
                <Eye className="mr-2 h-4 w-4 text-blue-600" />
                Visualizar
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full"
              >
                <a href={contract.url} download={contract.name} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Substituir arquivo
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={uploading}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          /* Estado: Nenhum Contrato Anexado */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors text-center ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40'
            }`}
          >
            <div className="p-3 rounded-full bg-muted mb-2 text-muted-foreground">
              <Paperclip className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">Nenhum contrato anexado</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-[220px]">
              Arraste seu arquivo PDF aqui ou selecione do seu computador
            </p>

            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Anexar Contrato (PDF)
                </>
              )}
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </CardContent>
    </Card>
  )
}
