# Script PowerShell para extrair apenas a estrutura (schema) de um dump PostgreSQL
# Remove todos os dados (COPY statements) e mantém apenas a estrutura

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile = "schema_only.sql"
)

Write-Host "Processando dump: $InputFile" -ForegroundColor Green

$content = Get-Content $InputFile -Raw
$lines = Get-Content $InputFile

$output = @()
$skipMode = $false
$inCopyBlock = $false

foreach ($line in $lines) {
    # Detectar início de bloco COPY
    if ($line -match '^COPY public\."') {
        $inCopyBlock = $true
        $skipMode = $true
        Write-Host "Removendo dados de: $line" -ForegroundColor Yellow
        continue
    }
    
    # Detectar fim de bloco COPY
    if ($inCopyBlock -and $line -eq '\.') {
        $inCopyBlock = $false
        $skipMode = $false
        continue
    }
    
    # Pular linhas dentro do bloco COPY
    if ($skipMode) {
        continue
    }
    
    # Remover comandos de setval que contêm dados
    if ($line -match '^SELECT pg_catalog\.setval') {
        # Manter apenas a criação da sequência, não o setval com dados
        continue
    }
    
    # Manter todas as outras linhas (estrutura)
    $output += $line
}

# Salvar resultado
$output | Set-Content $OutputFile -Encoding UTF8

Write-Host "`nScript gerado com sucesso: $OutputFile" -ForegroundColor Green
Write-Host "Linhas processadas: $($lines.Count)" -ForegroundColor Cyan
Write-Host "Linhas no output: $($output.Count)" -ForegroundColor Cyan




